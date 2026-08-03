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
  const customerPackage = await db.customerPackage.findFirst({
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
    orderBy: { createdAt: "desc" },
  });
  if (!customerPackage) return NextResponse.json({ membership: null, authenticated: true });
  return NextResponse.json({
    authenticated: true,
    membership: {
      id: customerPackage.id,
      planId: customerPackage.packagePlanId,
      planName: customerPackage.packagePlan.name,
      serviceId: customerPackage.packagePlan.serviceId,
      shareable: customerPackage.packagePlan.shareable,
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
    },
  });
}
