import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export async function GET() {
  const account = await getCustomerSession();
  if (!account) return NextResponse.json({ membership: null, authenticated: false });
  const customerPackages = await db.customerPackage.findMany({
    where: {
      customerId: account.customerId,
      status: "ACTIVE",
      expiresAt: { gte: new Date() },
      OR: [{ sessionsRemaining: { gt: 0 } }, { sessionsReserved: { gt: 0 } }],
    },
    include: {
      packagePlan: true,
      bookings: {
        where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"] } },
        orderBy: { updatedAt: "desc" },
        take: 50,
      },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    take: 20,
  });
  const memberships = customerPackages.map((customerPackage) => ({
      id: customerPackage.id,
      planId: customerPackage.packagePlanId,
      planName: customerPackage.planNameSnapshot ?? customerPackage.packagePlan.name,
      serviceId: customerPackage.serviceIdSnapshot ?? customerPackage.packagePlan.serviceId,
      shareable: customerPackage.shareableSnapshot ?? customerPackage.packagePlan.shareable,
      badge: null,
      totalSessions: customerPackage.sessionsTotal,
      availableSessions: customerPackage.sessionsRemaining,
      reservedSessions: customerPackage.sessionsReserved,
      usedSessions: Math.max(0, customerPackage.sessionsTotal - customerPackage.sessionsRemaining - customerPackage.sessionsReserved),
      purchasedAt: dateLabel(customerPackage.createdAt),
      expiresAt: dateLabel(customerPackage.expiresAt),
      usageHistory: customerPackage.bookings.map((booking) => {
        const usedAt = booking.completedAt ?? booking.updatedAt;
        return {
          date: dateLabel(usedAt),
          time: timeLabel(usedAt),
          bookingCode: booking.bookingCode,
          status: booking.status === "COMPLETED" ? "USED" : "RESERVED",
        };
      }),
    }));
  return NextResponse.json({
    authenticated: true,
    membership: memberships[0] ?? null,
    memberships,
  });
}
