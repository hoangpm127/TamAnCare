import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";

function dateParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("day")}/${part("month")}/${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

export async function GET() {
  const [account, guest] = await Promise.all([getCustomerSession(), getGuestSession()]);
  if (!account && !guest) return NextResponse.json({ entries: [], authenticated: false, guestAuthorized: false });

  const guestGrants = !account && guest
    ? await db.bookingAccessGrant.findMany({
        where: { guestSessionId: guest.id, expiresAt: { gt: new Date() } },
        select: { bookingGroupId: true, bookingId: true },
      })
    : [];
  const guestGroupIds = guestGrants.map((item) => item.bookingGroupId).filter((id): id is string => Boolean(id));
  const guestBookingIds = guestGrants.map((item) => item.bookingId).filter((id): id is string => Boolean(id));
  if (!account && guestGroupIds.length === 0 && guestBookingIds.length === 0) {
    return NextResponse.json({ entries: [], authenticated: false, guestAuthorized: false });
  }

  const customerId = account?.customerId;
  const [groups, directBookings, auxiliaryPayments, businessEvents, refundPayments] = await Promise.all([
    db.bookingGroup.findMany({
      where: customerId ? { customerId } : { id: { in: guestGroupIds } },
      include: {
        branch: true,
        bookings: {
          include: { service: true, therapist: true, customerPackage: { include: { packagePlan: true } } },
          orderBy: { startTime: "asc" },
        },
        refundRequests: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.findMany({
      where: customerId ? { customerId, groupId: null } : { id: { in: guestBookingIds }, groupId: null },
      include: { branch: true, service: true, therapist: true, customerPackage: { include: { packagePlan: true } }, refundRequests: { where: { status: "COMPLETED" }, select: { amount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    customerId ? db.paymentTransaction.findMany({
      where: {
        customerId,
        status: "CONFIRMED",
        idempotencyKey: { startsWith: "package:" },
      },
      include: { branch: true },
      orderBy: { paidAt: "desc" },
    }) : Promise.resolve([]),
    customerId ? db.officeEvent.findMany({
      where: { customerId },
      include: { branch: true, leadTherapist: true, tipPayout: true },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
    customerId ? db.paymentTransaction.findMany({
      where: { customerId, type: "REFUND", direction: "OUT", status: "CONFIRMED" },
      include: {
        branch: true,
        bookingGroup: { select: { referenceCode: true } },
        booking: { select: { bookingCode: true } },
        refundRequestPayment: { select: { reason: true, bankReference: true } },
      },
      orderBy: { paidAt: "desc" },
    }) : Promise.resolve([]),
  ]);

  const groupEntries = groups.flatMap((group) => {
    const first = group.bookings[0];
    const completed = group.status === "COMPLETED";
    const fullyPaid = completed && group.paymentStatus === "PAID";
    const refundAmount = group.refundRequests.reduce((sum, item) => sum + item.amount, 0);
    const customerPackage = first?.customerPackage;
    const tipAmount = group.bookings.reduce((sum, item) => sum + item.tipAmount, 0);
    if (!customerPackage && group.paidAmount <= 0 && !completed && group.paymentStatus !== "REFUNDED") return [];
    const settledAt = first?.checkoutRequestedAt ?? first?.completedAt ?? first?.endTime ?? group.updatedAt;
    const parts = dateParts(settledAt);
    const serviceStatus = group.status === "COMPLETED"
      ? "COMPLETED"
      : ["CHECKED_IN", "IN_SERVICE"].includes(group.status)
        ? "IN_SERVICE"
        : group.status === "CANCELLED"
          ? "CANCELLED"
          : group.status === "NO_SHOW"
            ? "NO_SHOW"
            : "RESERVED";
    return [{
      id: group.id,
      label: group.bookings.map((item) => item.service.name).join(", ") || "Dịch vụ Tâm An",
      amount: customerPackage ? 0 : completed ? group.totalAmount : group.paidAmount,
      totalAmount: group.totalAmount,
      depositAmount: customerPackage ? 0 : Math.min(group.depositAmount, group.paidAmount),
      tipAmount,
      refundAmount,
      date: parts.date,
      time: parts.time,
      scheduledTime: first?.startTime.toISOString(),
      actualCheckinTime: first?.checkedInAt?.toISOString(),
      checkoutRequestedAt: first?.checkoutRequestedAt?.toISOString(),
      serviceDurationMin: Math.max(...group.bookings.map((item) => item.durationMin), 0),
      therapistName: group.bookings.map((item) => item.therapist?.fullName).filter(Boolean).join(", ") || undefined,
      branchLabel: group.branch.name.replace(/^Tâm An Center · /, ""),
      items: group.bookings.map((item) => ({ name: item.service.name, qty: 1, amount: item.basePrice + item.therapistFee })),
      bookingCode: group.referenceCode,
      note: customerPackage
        ? `${completed ? "Đã hoàn tất" : "Đã giữ"} lượt trong ${customerPackage.planNameSnapshot ?? customerPackage.packagePlan.name}`
        : completed
          ? "Đã thanh toán đầy đủ tại Tâm An Center"
          : group.status === "CANCELLED"
            ? "Lịch đã hủy; khoản đã thu cần được bảo lưu hoặc hoàn theo xử lý của cơ sở."
            : group.status === "NO_SHOW"
              ? "Vắng hẹn; áp dụng chính sách cọc theo số lần trong tháng."
              : "Đã đặt cọc · Dịch vụ chưa hoàn tất",
      paymentStatus: customerPackage
        ? "PACKAGE_SESSION"
        : group.paymentStatus === "REFUNDED"
          ? "REFUNDED"
          : completed && !fullyPaid
            ? "PARTIALLY_REFUNDED"
            : completed
              ? "PAID_IN_FULL"
              : "DEPOSIT_ONLY",
      serviceStatus,
      packageName: customerPackage?.planNameSnapshot ?? customerPackage?.packagePlan.name,
    }];
  });
  const directEntries = directBookings.flatMap((booking) => {
    const completed = booking.status === "COMPLETED";
    const fullyPaid = completed && booking.paymentStatus === "PAID";
    const refundAmount = booking.refundRequests.reduce((sum, item) => sum + item.amount, 0);
    const customerPackage = booking.customerPackage;
    if (!customerPackage && booking.paidAmount <= 0 && !completed && booking.paymentStatus !== "REFUNDED") return [];
    const parts = dateParts(booking.checkoutRequestedAt ?? booking.completedAt ?? booking.endTime);
    const serviceStatus = booking.status === "COMPLETED"
      ? "COMPLETED"
      : ["CHECKED_IN", "IN_SERVICE"].includes(booking.status)
        ? "IN_SERVICE"
        : booking.status === "CANCELLED"
          ? "CANCELLED"
          : booking.status === "NO_SHOW"
            ? "NO_SHOW"
            : "RESERVED";
    return [{
      id: booking.id,
      label: booking.service.name,
      amount: customerPackage ? 0 : completed ? booking.totalAmount : booking.paidAmount,
      totalAmount: booking.totalAmount,
      depositAmount: customerPackage ? 0 : Math.min(booking.depositAmount, booking.paidAmount),
      tipAmount: booking.tipAmount,
      refundAmount,
      date: parts.date,
      time: parts.time,
      scheduledTime: booking.startTime.toISOString(),
      actualCheckinTime: booking.checkedInAt?.toISOString(),
      checkoutRequestedAt: booking.checkoutRequestedAt?.toISOString(),
      serviceDurationMin: booking.durationMin,
      therapistName: booking.therapist?.fullName,
      branchLabel: booking.branch.name.replace(/^Tâm An Center · /, ""),
      items: [{ name: booking.service.name, qty: 1, amount: booking.basePrice + booking.therapistFee }],
      bookingCode: booking.bookingCode,
      note: customerPackage
        ? `${completed ? "Đã hoàn tất" : "Đã giữ"} lượt trong ${customerPackage.planNameSnapshot ?? customerPackage.packagePlan.name}`
        : completed
          ? "Đã thanh toán đầy đủ tại Tâm An Center"
          : booking.status === "CANCELLED"
            ? "Lịch đã hủy; khoản đã thu cần được bảo lưu hoặc hoàn theo xử lý của cơ sở."
            : booking.status === "NO_SHOW"
              ? "Vắng hẹn; áp dụng chính sách cọc theo số lần trong tháng."
              : "Đã đặt cọc · Dịch vụ chưa hoàn tất",
      paymentStatus: customerPackage
        ? "PACKAGE_SESSION"
        : booking.paymentStatus === "REFUNDED"
          ? "REFUNDED"
          : completed && !fullyPaid
            ? "PARTIALLY_REFUNDED"
            : completed
              ? "PAID_IN_FULL"
              : "DEPOSIT_ONLY",
      serviceStatus,
      packageName: customerPackage?.planNameSnapshot ?? customerPackage?.packagePlan.name,
    }];
  });
  const auxiliaryEntries = auxiliaryPayments.map((payment) => {
    const paidAt = payment.paidAt ?? payment.createdAt;
    const parts = dateParts(paidAt);
    const bookingCode = payment.idempotencyKey.replace("package:", "");
    return {
      id: payment.id,
      label: payment.note?.replace(/^Mua gói thành viên · /, "") || "Gói thành viên Tâm An",
      amount: payment.amount,
      totalAmount: payment.amount,
      date: parts.date,
      time: parts.time,
      branchLabel: payment.branch.name.replace(/^Tâm An Center · /, ""),
      bookingCode,
      note: payment.note,
      paymentStatus: "PACKAGE_PURCHASE" as const,
      serviceStatus: "NOT_APPLICABLE" as const,
    };
  });
  const businessEntries = businessEvents.map((event) => {
    const completed = event.status === "COMPLETED" && event.paymentStatus === "PAID";
    const settledAt = event.completedAt ?? event.actualEndedAt ?? event.updatedAt;
    const parts = dateParts(settledAt);
    const actualMinutes = event.actualStartedAt && event.actualEndedAt
      ? Math.max(0, Math.round((event.actualEndedAt.getTime() - event.actualStartedAt.getTime()) / 60_000))
      : Math.max(0, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000));
    return {
      id: event.id,
      label: `Tâm An Business · ${event.companyName}`,
      amount: completed ? event.totalAmount + (event.tipPayout?.amount ?? 0) : event.paidAmount,
      totalAmount: event.totalAmount,
      depositAmount: Math.min(event.depositAmount, event.paidAmount),
      tipAmount: event.tipPayout?.amount ?? 0,
      date: parts.date,
      time: parts.time,
      scheduledTime: event.startsAt.toISOString(),
      actualCheckinTime: event.actualStartedAt?.toISOString(),
      serviceDurationMin: actualMinutes,
      therapistName: event.leadTherapist?.fullName,
      branchLabel: event.branch.name.replace(/^Tâm An Center · /, ""),
      items: [
        { name: event.serviceLabel ?? "Chăm sóc sức khỏe doanh nghiệp", qty: event.headcount, amount: Math.max(0, event.subtotalAmount - event.discountAmount) },
        ...(event.transportFee > 0 ? [{ name: "Điều phối & di chuyển", qty: event.requiredTherapists, amount: event.transportFee }] : []),
      ],
      bookingCode: event.eventCode,
      note: completed
        ? "Đã hoàn tất dịch vụ và thanh toán đầy đủ."
        : event.status === "AWAITING_BALANCE"
          ? `Đã kết thúc phục vụ · còn ${event.totalAmount - event.paidAmount}đ chờ đối soát.`
          : "Đã đặt cọc · hồ sơ Business đang được triển khai.",
      paymentStatus: completed ? "PAID_IN_FULL" as const : "DEPOSIT_ONLY" as const,
      serviceStatus: completed ? "COMPLETED" as const : event.status === "IN_SERVICE" ? "IN_SERVICE" as const : event.status === "CANCELLED" ? "CANCELLED" as const : "RESERVED" as const,
      isBusiness: true,
    };
  });
  const refundEntries = refundPayments.map((payment) => {
    const paidAt = payment.paidAt ?? payment.createdAt;
    const parts = dateParts(paidAt);
    const referenceCode = payment.bookingGroup?.referenceCode ?? payment.booking?.bookingCode ?? payment.paymentCode ?? "";
    return {
      id: payment.id,
      label: "Hoàn tiền từ Tâm An Center",
      amount: -payment.amount,
      totalAmount: payment.amount,
      date: parts.date,
      time: parts.time,
      branchLabel: payment.branch.name.replace(/^Tâm An Center · /, ""),
      bookingCode: referenceCode,
      note: `${payment.refundRequestPayment?.reason ?? "Hoàn tiền dịch vụ"}${payment.refundRequestPayment?.bankReference ? ` · Mã ngân hàng ${payment.refundRequestPayment.bankReference}` : ""}`,
      paymentStatus: "REFUND" as const,
      serviceStatus: "NOT_APPLICABLE" as const,
    };
  });

  return NextResponse.json({
    authenticated: Boolean(account),
    guestAuthorized: !account && (guestGroupIds.length > 0 || guestBookingIds.length > 0),
    entries: [...refundEntries, ...groupEntries, ...directEntries, ...businessEntries, ...auxiliaryEntries],
  });
}
