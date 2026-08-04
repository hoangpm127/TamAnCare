import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { affiliateCommissionAmount, AFFILIATE_RECONCILIATION_DAYS } from "@/lib/referral-policy";
import { getCustomerSession } from "@/lib/server/customer-session";
import { ledgerReportWhere } from "@/lib/server/ledger-reporting";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

function businessDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function displayDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export async function GET() {
  const account = await getCustomerSession();
  if (!account) return NextResponse.json({ authenticated: false, summary: null });
  const [campaigns, affiliateProfile] = await Promise.all([
    db.campaign.findMany({
      where: { source: `AFFILIATE:${account.customerId}` },
      orderBy: { createdAt: "asc" },
    }),
    db.customerAccount.findUnique({
      where: { customerId: account.customerId },
      select: { affiliateArea: true, affiliateBankName: true, affiliateBankAccount: true, affiliateBankHolder: true },
    }),
  ]);
  const activationRequired = phoneVerificationRequired() && !account.phoneVerifiedAt;
  const code = activationRequired ? "" : campaigns[0]?.code ?? "";
  if (!campaigns.length) {
    return NextResponse.json({
      authenticated: true,
      summary: {
        code,
        activationRequired,
        rewardForYou: `10% doanh thu dịch vụ/gói đủ điều kiện · đối soát ${AFFILIATE_RECONCILIATION_DAYS} ngày`,
        rewardForFriend: "Đặt lịch nhanh qua link/QR và vẫn dùng ưu đãi đang đủ điều kiện",
        profile: affiliateProfile,
        totalEarned: 0,
        monthlyEarnings: [],
        invited: [],
      },
    });
  }
  const [bookings, commissions] = await Promise.all([
    db.booking.findMany({
      where: { campaignId: { in: campaigns.map((item) => item.id) } },
      include: { customer: true, service: true, group: { include: { bookings: true } }, campaign: true },
      orderBy: { startTime: "desc" },
    }),
    db.ledgerEntry.findMany({
      where: { ...ledgerReportWhere(), customerId: account.customerId, category: "OPERATING_EXPENSE", description: { startsWith: "Hoa hồng Affiliate" } },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const commissionByOrder = new Map(
    commissions.map((commission) => [commission.bookingGroupId ?? commission.bookingId ?? commission.id, commission]),
  );
  const uniqueOrders = [...new Map(bookings.map((booking) => [booking.groupId ?? booking.id, booking])).values()];
  const candidateOrders = uniqueOrders.map((booking) => {
    const orderId = booking.groupId ?? booking.id;
    const commission = commissionByOrder.get(orderId);
    const groupBookings = booking.group?.bookings ?? [booking];
    const category = groupBookings.length > 1 ? "GROUP" as const : "INDIVIDUAL" as const;
    return {
      id: orderId,
      friendId: booking.customerId,
      friendName: booking.customer.fullName,
      friendTotalVisits: booking.customer.totalVisits,
      serviceLabel: booking.group ? `${groupBookings.length} dịch vụ cùng lịch` : booking.service.name,
      amount: booking.group?.totalAmount ?? booking.totalAmount,
      commission: commission?.amount ?? affiliateCommissionAmount(booking.group?.totalAmount ?? booking.totalAmount),
      status: commission ? "COMPLETED" as const : "SCHEDULED" as const,
      bookingStatus: booking.group?.status ?? booking.status,
      date: displayDate(booking.startTime),
      isoDate: businessDate(booking.startTime),
      category,
      startTime: booking.startTime,
      rewarded: Boolean(commission),
    };
  });

  // Giữ toàn bộ khoản đã hạch toán; với khách chưa phát sinh hoa hồng, chỉ hiển thị
  // booking còn hiệu lực gần nhất làm dự kiến để tránh đếm trùng các lần giữ chỗ.
  const orders = [...new Set(candidateOrders.map((order) => order.friendId))].flatMap((friendId) => {
    const friendOrders = candidateOrders.filter((order) => order.friendId === friendId);
    const rewarded = friendOrders.filter((order) => order.rewarded);
    if (rewarded.length) return rewarded;
    const projected = friendOrders
      .filter((order) => ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"].includes(order.bookingStatus))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
    return projected ? [projected] : [];
  });

  const friends = [...new Map(orders.map((order) => [order.friendId, order.friendName])).entries()].map(([friendId, name]) => {
    const friendOrders = orders.filter((order) => order.friendId === friendId).map((order) => ({
      id: order.id,
      serviceLabel: order.serviceLabel,
      amount: order.amount,
      commission: order.commission,
      status: order.status,
      date: order.date,
      isoDate: order.isoDate,
      category: order.category,
    }));
    const reward = friendOrders.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + item.commission, 0);
    return {
      name,
      status: friendOrders.some((item) => item.status === "COMPLETED") ? "COMPLETED" as const : "PENDING" as const,
      reward,
      joinedAt: friendOrders.at(-1)?.date ?? "",
      note: friendOrders.some((item) => item.category === "GROUP") ? "Khách theo nhóm" : "Khách cá nhân",
      orders: friendOrders,
    };
  });
  const monthlyMap = new Map<string, number>();
  for (const commission of commissions) {
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(commission.occurredAt);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + commission.amount);
  }
  const monthlyEarnings = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month: `T${Number(month.slice(5))}`, amount }));
  return NextResponse.json({
    authenticated: true,
    summary: {
      code,
      activationRequired,
      rewardForYou: `10% doanh thu dịch vụ/gói đủ điều kiện · đối soát ${AFFILIATE_RECONCILIATION_DAYS} ngày`,
      rewardForFriend: "Đặt lịch nhanh qua link/QR và vẫn dùng ưu đãi đang đủ điều kiện",
      profile: affiliateProfile,
      totalEarned: commissions.reduce((sum, item) => sum + item.amount, 0),
      monthlyEarnings,
      invited: friends,
    },
  });
}
