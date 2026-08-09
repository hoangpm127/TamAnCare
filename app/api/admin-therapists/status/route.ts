import { NextResponse } from "next/server";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";

function businessDayRange(now: Date) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { start: new Date(`${date}T00:00:00+07:00`), end: new Date(`${date}T23:59:59.999+07:00`) };
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "therapists")) {
    return NextResponse.json({ error: "Không có quyền xem trạng thái KTV." }, { status: 403 });
  }
  const requestedBranch = new URL(request.url).searchParams.get("branchId");
  const branchId = session.role === "OWNER" ? requestedBranch || undefined : session.branchId ?? "__none__";
  const now = new Date();
  const day = businessDayRange(now);
  const [branches, services, therapists, bookings, businessEvents] = await Promise.all([
    db.branch.findMany({
      where: session.role === "OWNER" ? (branchId ? { id: branchId } : {}) : { id: branchId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.therapist.findMany({
      where: { ...(branchId ? { branchId } : {}), status: { not: "HIDDEN" } },
      orderBy: [{ branchId: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        branchId: true,
        fullName: true,
        phone: true,
        gender: true,
        skills: true,
        onlineBooking: true,
        internalNote: true,
        status: true,
        shiftLabel: true,
        ratingAvg: true,
        avatarUrl: true,
        publicBio: true,
        publicStrengths: true,
        profileApprovalStatus: true,
        proposedAvatarUrl: true,
        proposedBio: true,
        proposedStrengths: true,
        profileSubmittedAt: true,
        profileReviewNote: true,
        services: { select: { id: true } },
        weeklySchedules: {
          orderBy: { weekday: "asc" },
          select: { weekday: true, startMinute: true, endMinute: true, isActive: true },
        },
      },
    }),
    db.booking.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        therapistId: { not: null },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] },
        startTime: { lte: day.end },
        endTime: { gte: day.start },
      },
      include: { customer: true, service: true, room: true },
      orderBy: { startTime: "asc" },
    }),
    db.officeEvent.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        leadTherapistId: { not: null },
        status: { in: ["READY", "IN_SERVICE", "AWAITING_BALANCE"] },
        startsAt: { lte: day.end },
        endsAt: { gte: day.start },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const rows = therapists.map((therapist) => {
    const therapistBookings = bookings.filter((booking) => booking.therapistId === therapist.id);
    const liveBooking = therapistBookings.find((booking) => ["CHECKED_IN", "IN_SERVICE"].includes(booking.status) && !booking.checkoutRequestedAt);
    const closingBooking = therapistBookings.find((booking) => ["CHECKED_IN", "IN_SERVICE"].includes(booking.status) && booking.checkoutRequestedAt);
    const liveBusiness = businessEvents.find((event) => event.leadTherapistId === therapist.id && event.status === "IN_SERVICE");
    const upcomingBooking = therapistBookings.find((booking) => ["PENDING", "CONFIRMED"].includes(booking.status) && booking.startTime > now);
    const upcomingBusiness = businessEvents.find((event) => event.leadTherapistId === therapist.id && event.status === "READY" && event.startsAt > now);
    const nextRegularTime = upcomingBooking?.startTime.getTime() ?? Number.POSITIVE_INFINITY;
    const nextBusinessTime = upcomingBusiness?.startsAt.getTime() ?? Number.POSITIVE_INFINITY;
    const next = nextRegularTime <= nextBusinessTime
      ? upcomingBooking ? { type: "CARE" as const, label: upcomingBooking.service.name, customerName: upcomingBooking.customer.fullName, startsAt: upcomingBooking.startTime.toISOString() } : null
      : upcomingBusiness ? { type: "BUSINESS" as const, label: upcomingBusiness.companyName, customerName: upcomingBusiness.location, startsAt: upcomingBusiness.startsAt.toISOString() } : null;
    const regularExpectedEnd = liveBooking
      ? new Date((liveBooking.checkedInAt?.getTime() ?? liveBooking.startTime.getTime()) + liveBooking.durationMin * 60_000)
      : null;
    const live = liveBusiness ? {
      type: "BUSINESS" as const,
      label: liveBusiness.companyName,
      detail: liveBusiness.location,
      serviceName: liveBusiness.serviceLabel ?? "Tâm An Business",
      roomName: null,
      startedAt: liveBusiness.actualStartedAt?.toISOString() ?? liveBusiness.startsAt.toISOString(),
      expectedEndAt: liveBusiness.expectedEndAt?.toISOString() ?? liveBusiness.endsAt.toISOString(),
      requiredTherapists: liveBusiness.requiredTherapists,
    } : liveBooking ? {
      type: "CARE" as const,
      label: liveBooking.customer.fullName,
      detail: liveBooking.bookingCode,
      serviceName: liveBooking.service.name,
      roomName: liveBooking.room?.name ?? "Chờ xếp giường",
      startedAt: liveBooking.checkedInAt?.toISOString() ?? liveBooking.startTime.toISOString(),
      expectedEndAt: regularExpectedEnd?.toISOString() ?? liveBooking.endTime.toISOString(),
      requiredTherapists: 1,
    } : null;
    const liveStatus = therapist.status !== "ACTIVE" ? "OFF"
      : liveBusiness ? "BUSINESS"
        : liveBooking ? "BUSY"
          : closingBooking ? "WRAP_UP"
            : "AVAILABLE";
    return {
      id: therapist.id,
      branchId: therapist.branchId,
      fullName: therapist.fullName,
      phone: therapist.phone,
      gender: therapist.gender,
      skills: therapist.skills,
      onlineBooking: therapist.onlineBooking,
      internalNote: therapist.internalNote,
      status: therapist.status,
      shiftLabel: therapist.shiftLabel,
      ratingAvg: therapist.ratingAvg,
      avatarUrl: therapist.avatarUrl,
      publicBio: therapist.publicBio,
      publicStrengths: therapist.publicStrengths,
      profileApprovalStatus: therapist.profileApprovalStatus,
      proposedAvatarUrl: therapist.proposedAvatarUrl,
      proposedBio: therapist.proposedBio,
      proposedStrengths: therapist.proposedStrengths,
      profileSubmittedAt: therapist.profileSubmittedAt?.toISOString() ?? null,
      profileReviewNote: therapist.profileReviewNote,
      serviceIds: therapist.services.map((service) => service.id),
      schedules: therapist.weeklySchedules,
      liveStatus,
      live,
      wrapUp: closingBooking ? { customerName: closingBooking.customer.fullName, checkoutRequestedAt: closingBooking.checkoutRequestedAt?.toISOString() } : null,
      next,
    };
  });

  return NextResponse.json({
    generatedAt: now.toISOString(),
    branches: branches.map((branch) => ({ id: branch.id, label: branch.name.replace(/^Tâm An Center · /, "") })),
    services,
    therapists: rows,
    businessStaffing: businessEvents.filter((event) => event.status === "IN_SERVICE").map((event) => ({
      eventCode: event.eventCode,
      branchId: event.branchId,
      companyName: event.companyName,
      requiredTherapists: event.requiredTherapists,
      trackedTherapists: event.leadTherapistId ? 1 : 0,
      staffingGap: Math.max(0, event.requiredTherapists - (event.leadTherapistId ? 1 : 0)),
    })),
  });
}
