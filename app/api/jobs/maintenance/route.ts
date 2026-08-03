import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireUnpaidBookingHolds } from "@/lib/server/booking-dal";
import { isCronAuthorized } from "@/lib/server/cron-auth";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { sendBusinessEndReminder } from "@/lib/server/business-service";
import { maybeAutoConfirmBookingGroup } from "@/lib/server/booking-automation";

export const dynamic = "force-dynamic";

function businessDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    date,
    start: new Date(`${date}T00:00:00+07:00`),
    end: new Date(`${date}T23:59:59.999+07:00`),
  };
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Không có quyền chạy tác vụ." }, { status: 401 });
  const now = new Date();
  const day = businessDayRange(now);
  const expiredBookingGroups = await expireUnpaidBookingHolds();

  const paidPendingGroups = await db.bookingGroup.findMany({
    where: { status: "PENDING", paymentStatus: { in: ["DEPOSITED", "PAID"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let automaticallyConfirmedBookings = 0;
  let bookingsWaitingForResources = 0;
  for (const group of paidPendingGroups) {
    try {
      const result = await db.$transaction(async (tx) => {
        const confirmation = await maybeAutoConfirmBookingGroup(tx, group.id);
        if (!confirmation.changed) return confirmation;
        const confirmedGroup = await tx.bookingGroup.findUnique({
          where: { id: group.id },
          include: { customer: true },
        });
        if (!confirmedGroup) return confirmation;
        await notifyCustomer(tx, confirmedGroup.customerId, {
          branchId: confirmedGroup.branchId,
          type: "BOOKING",
          title: "Chúc mừng! Lịch đã được IQ Care xác nhận",
          body: `${confirmedGroup.referenceCode} đã được xếp ${confirmation.assignments.map((item) => `${item.therapistName} · ${item.roomName}`).join(", ")}. Bạn có thể mở Đơn của tôi để xem lịch và check-in tại cơ sở.`,
          actionUrl: `/booking/success/${confirmedGroup.referenceCode}`,
        });
        await notifyOperations(tx, {
          branchId: confirmedGroup.branchId,
          type: "BOOKING",
          title: `IQ Care tự xử lý lịch đã cọc · ${confirmedGroup.customer.fullName}`,
          body: `${confirmedGroup.referenceCode} đã được xác nhận và phân công ${confirmation.assignments.map((item) => `${item.therapistName} tại ${item.roomName}`).join(", ")}.`,
          actionUrl: "/admin/bookings",
        });
        for (const assignment of confirmation.assignments) {
          await notifyTherapist(tx, {
            branchId: confirmedGroup.branchId,
            therapistName: assignment.therapistName,
            type: "BOOKING",
            title: `IQ Care vừa điều phối lịch mới · ${confirmedGroup.customer.fullName}`,
            body: `${assignment.serviceName} · ${confirmedGroup.referenceCode} · ${assignment.roomName}. Lịch đã sẵn sàng trong Lịch của tôi.`,
            actionUrl: `/therapist/bookings/${assignment.bookingCode}`,
          });
        }
        return confirmation;
      });
      if (result.changed) automaticallyConfirmedBookings += 1;
      if (result.enabled && result.reason === "NO_RESOURCE") bookingsWaitingForResources += 1;
    } catch (error) {
      console.error("booking_automation.maintenance_failed", { groupId: group.id, error });
    }
  }

  const cleanup = await db.$transaction(async (tx) => {
    const paymentGrants = await tx.paymentAccessGrant.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { guestSession: { expiresAt: { lte: now } } }] },
    });
    const businessGrants = await tx.businessAccessGrant.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { guestSession: { expiresAt: { lte: now } } }] },
    });
    const customerSessions = await tx.customerSession.deleteMany({ where: { expiresAt: { lte: now } } });
    const passwordResetChallenges = await tx.passwordResetChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
          { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
        ],
      },
    });
    const phoneOtpChallenges = await tx.phoneOtpChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
          { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
        ],
      },
    });
    const adminSessions = await tx.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
    const guestSessions = await tx.guestSession.deleteMany({ where: { expiresAt: { lte: now } } });
    const staleRateLimits = await tx.rateLimitCounter.deleteMany({
      where: { updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60_000) } },
    });
    const unusedExpenseEvidence = await tx.expenseEvidence.deleteMany({
      where: { usedAt: null, createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    });
    return {
      paymentGrants: paymentGrants.count,
      businessGrants: businessGrants.count,
      customerSessions: customerSessions.count,
      passwordResetChallenges: passwordResetChallenges.count,
      phoneOtpChallenges: phoneOtpChallenges.count,
      adminSessions: adminSessions.count,
      guestSessions: guestSessions.count,
      staleRateLimits: staleRateLimits.count,
      unusedExpenseEvidence: unusedExpenseEvidence.count,
    };
  });

  const dueBusinessEvents = await db.officeEvent.findMany({
    where: { status: "IN_SERVICE", expectedEndAt: { lte: now }, endReminderSentAt: null },
    select: { eventCode: true },
  });
  let businessEndReminders = 0;
  for (const event of dueBusinessEvents) {
    await db.$transaction((tx) => sendBusinessEndReminder(tx, event.eventCode, now));
    businessEndReminders += 1;
  }

  const activeServices = await db.booking.findMany({
    where: {
      status: "IN_SERVICE",
      checkedInAt: { not: null },
      endingSoonReminderSentAt: null,
    },
    include: { customer: true, service: true, therapist: true, group: true },
    orderBy: { checkedInAt: "asc" },
    take: 200,
  });
  const dueServiceReminders = activeServices.filter((booking) => {
    const plannedEndAt = booking.checkedInAt!.getTime() + booking.durationMin * 60_000;
    return plannedEndAt <= now.getTime() + 3 * 60_000 && plannedEndAt >= now.getTime() - 5 * 60_000;
  });
  let serviceEndingReminders = 0;
  for (const booking of dueServiceReminders) {
    const changed = await db.$transaction(async (tx) => {
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, status: "IN_SERVICE", endingSoonReminderSentAt: null },
        data: { endingSoonReminderSentAt: now },
      });
      if (!claimed.count) return false;
      const referenceCode = booking.group?.referenceCode ?? booking.bookingCode;
      await notifyTherapist(tx, {
        branchId: booking.branchId,
        therapistName: booking.therapist?.fullName,
        type: "REMINDER",
        title: `Ca còn khoảng 3 phút · ${booking.customer.fullName}`,
        body: `${booking.service.name} · ${referenceCode}. Vui lòng chuẩn bị kết thúc liệu trình khéo léo và hướng dẫn khách đối soát Bill tại quầy.`,
        actionUrl: `/therapist/bookings/${booking.bookingCode}`,
      });
      await notifyOperations(tx, {
        branchId: booking.branchId,
        type: "REMINDER",
        title: `Sắp kết thúc ca · ${booking.customer.fullName}`,
        body: `${booking.service.name} · ${referenceCode} còn khoảng 3 phút. Quầy chuẩn bị đối soát phần Bill còn lại; Tip KTV tách riêng.`,
        actionUrl: "/admin/bookings",
      });
      return true;
    });
    if (changed) serviceEndingReminders += 1;
  }

  const dueByBranch = await db.tipPayout.groupBy({
    by: ["branchId"],
    where: { status: "PENDING", dueAt: { lte: now } },
    _count: { _all: true },
    _sum: { amount: true },
  });
  let tipReminderBranches = 0;
  for (const summary of dueByBranch) {
    const alreadyNotified = await db.notification.findFirst({
      where: {
        branchId: summary.branchId,
        type: "FINANCE",
        title: "Tip KTV đến hạn cần xác nhận chi trả",
        createdAt: { gte: day.start, lte: day.end },
      },
      select: { id: true },
    });
    if (alreadyNotified) continue;
    await db.$transaction(async (tx) => {
      await notifyOperations(tx, {
        branchId: summary.branchId,
        audience: "MANAGEMENT",
        type: "FINANCE",
        title: "Tip KTV đến hạn cần xác nhận chi trả",
        body: `${summary._count._all} khoản · ${money(summary._sum.amount ?? 0)} đang chờ Admin/Quản lý xác nhận đã chi thực tế.`,
        actionUrl: "/admin/finance",
      });
    });
    tipReminderBranches += 1;
  }

  const completedAt = new Date();
  await db.systemSetting.upsert({
    where: { scopeKey: "GLOBAL:operations.maintenance_last_success_at" },
    create: {
      key: "operations.maintenance_last_success_at",
      scopeKey: "GLOBAL:operations.maintenance_last_success_at",
      category: "OPERATIONS",
      label: "Tác vụ nền chạy thành công gần nhất",
      value: completedAt.toISOString(),
      valueType: "DATETIME",
      description: "Heartbeat tự động của tác vụ giải phóng lịch, dọn phiên và nhắc kết thúc ca/Tip/Business.",
    },
    update: { value: completedAt.toISOString(), isActive: true },
  });

  return NextResponse.json({
    success: true,
    businessDate: day.date,
    expiredBookingGroups,
    paidPendingBookings: paidPendingGroups.length,
    automaticallyConfirmedBookings,
    bookingsWaitingForResources,
    cleanup,
    dueTipBranches: dueByBranch.length,
    tipReminderBranches,
    businessEndReminders,
    serviceEndingReminders,
    completedAt: completedAt.toISOString(),
  });
}
