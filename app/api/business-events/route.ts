import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessRequestIdentity } from "@/lib/server/business-access";
import { therapistForSession } from "@/lib/server/therapist-session";

export async function GET(request: Request) {
  const customerAudience = new URL(request.url).searchParams.get("audience") === "customer";
  const identity = await businessRequestIdentity();
  if (customerAudience ? !identity.customer && !identity.guest : !identity.admin && !identity.customer && !identity.guest) {
    return NextResponse.json({ events: [], authenticated: false });
  }
  const sessionTherapist = !customerAudience && identity.admin?.role === "THERAPIST" ? await therapistForSession(identity.admin) : null;
  const guestEventIds = identity.guest
    ? (await db.businessAccessGrant.findMany({ where: { guestSessionId: identity.guest.id, expiresAt: { gt: new Date() } }, select: { officeEventId: true } })).map((item) => item.officeEventId)
    : [];
  const adminWhere = !customerAudience && identity.admin
    ? identity.admin.role === "OWNER"
      ? {}
      : identity.admin.role === "THERAPIST"
        ? { leadTherapistId: sessionTherapist?.id ?? "__none__" }
        : { branchId: identity.admin.branchId ?? "__none__" }
    : null;
  const events = await db.officeEvent.findMany({
    where: adminWhere ?? {
      OR: [
        ...(identity.customer ? [{ customerId: identity.customer.customerId }] : []),
        ...(guestEventIds.length ? [{ id: { in: guestEventIds } }] : []),
      ],
    },
    include: { branch: true, leadTherapist: true, payments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    ...(customerAudience ? { authenticated: Boolean(identity.customer) } : {}),
    events: events.map((event) => ({
      eventCode: event.eventCode,
      companyName: event.companyName,
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      location: event.location,
      serviceLabel: event.serviceLabel,
      packageTier: event.packageTier,
      branchName: event.branch.name,
      branchId: event.branchId,
      leadTherapist: event.leadTherapist?.fullName ?? null,
      status: event.status,
      paymentStatus: event.paymentStatus,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      headcount: event.headcount,
      durationMin: event.durationMin,
      requiredTherapists: event.requiredTherapists,
      actualStartedAt: event.actualStartedAt?.toISOString() ?? null,
      actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
      totalAmount: event.totalAmount,
      depositAmount: event.depositAmount,
      paidAmount: event.paidAmount,
      customerRating: event.customerRating,
    })),
  });
}
