import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilityAssignmentSchema } from "@/lib/facility-admin";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { therapistWorksDuring } from "@/lib/server/therapist-schedule";

const ASSIGNABLE_STATUSES = ["CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền điều phối giường và KTV." }, { status: 403 });
  }
  const parsed = facilityAssignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin điều phối chưa hợp lệ." }, { status: 400 });

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { branch: true, customer: true, service: true, room: true, therapist: true },
  });
  if (!booking || !ASSIGNABLE_STATUSES.includes(booking.status as (typeof ASSIGNABLE_STATUSES)[number])) {
    return NextResponse.json({ error: "Booking không còn ở trạng thái có thể điều phối." }, { status: 409 });
  }
  if (session.role !== "OWNER" && session.branchId !== booking.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được điều phối booking tại cơ sở phụ trách." }, { status: 403 });
  }

  const [bed, therapist] = await Promise.all([
    db.room.findUnique({
      where: { id: parsed.data.bedId },
      include: { facilityRoom: { include: { floor: true } } },
    }),
    db.therapist.findUnique({
      where: { id: parsed.data.therapistId },
      include: {
        services: { select: { id: true } },
        weeklySchedules: { where: { isActive: true } },
      },
    }),
  ]);
  const hierarchyActive = bed?.facilityRoom
    ? bed.facilityRoom.status === "ACTIVE" && bed.facilityRoom.floor.status === "ACTIVE"
    : true;
  if (!bed || bed.branchId !== booking.branchId || bed.status !== "ACTIVE" || !hierarchyActive) {
    return NextResponse.json({ error: "Giường/ghế đã chọn đang ngừng hoạt động hoặc không thuộc cơ sở." }, { status: 409 });
  }
  if (!bed.suitableCategories.includes(booking.service.category)) {
    return NextResponse.json({ error: "Giường/ghế này không phù hợp nhóm dịch vụ của khách." }, { status: 409 });
  }
  if (!therapist || therapist.branchId !== booking.branchId || therapist.status !== "ACTIVE") {
    return NextResponse.json({ error: "KTV đã chọn không sẵn sàng tại cơ sở." }, { status: 409 });
  }
  if (!therapist.services.some((service) => service.id === booking.serviceId)) {
    return NextResponse.json({ error: "KTV chưa được cấu hình cho dịch vụ này." }, { status: 409 });
  }
  if (!therapistWorksDuring(therapist.weeklySchedules, booking.startTime, booking.endTime)) {
    return NextResponse.json({ error: "Booking nằm ngoài lịch làm việc định kỳ của KTV." }, { status: 409 });
  }

  const conflict = await db.booking.findFirst({
    where: {
      id: { not: booking.id },
      branchId: booking.branchId,
      status: { in: [...BLOCKING_STATUSES] },
      startTime: { lt: addMinutes(booking.endTime, booking.branch.bufferMinutes) },
      endTime: { gt: addMinutes(booking.startTime, -booking.branch.bufferMinutes) },
      OR: [{ roomId: bed.id }, { therapistId: therapist.id }],
    },
    include: { customer: { select: { fullName: true } }, room: { select: { name: true } }, therapist: { select: { fullName: true } } },
  });
  if (conflict) {
    const resource = conflict.roomId === bed.id ? `giường ${bed.name}` : `KTV ${therapist.fullName}`;
    return NextResponse.json({ error: `${resource} đang trùng lịch với khách ${conflict.customer.fullName}.` }, { status: 409 });
  }

  const changed = booking.roomId !== bed.id || booking.therapistId !== therapist.id;
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.booking.update({ where: { id: booking.id }, data: { roomId: bed.id, therapistId: therapist.id } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: booking.branchId,
        action: "BOOKING_RESOURCE_ASSIGNMENT",
        entityType: "Booking",
        entityId: booking.id,
        before: { roomId: booking.roomId, therapistId: booking.therapistId },
        after: { roomId: bed.id, therapistId: therapist.id, bookingCode: booking.bookingCode },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    if (changed) {
      await notifyOperations(tx, {
        branchId: booking.branchId,
        type: "BOOKING",
        title: `Đã điều phối ${booking.customer.fullName}`,
        body: `${booking.bookingCode} · ${bed.name} · KTV ${therapist.fullName}.`,
        actionUrl: "/admin/rooms",
      });
      await notifyTherapist(tx, {
        branchId: booking.branchId,
        therapistName: therapist.fullName,
        type: "BOOKING",
        title: `Lễ tân vừa xếp ca · ${booking.customer.fullName}`,
        body: `${booking.service.name} · ${bed.name} · ${booking.bookingCode}.`,
        actionUrl: `/therapist/bookings/${booking.bookingCode}`,
      });
    }
    return result;
  });

  return NextResponse.json({
    booking: updated,
    assignment: { bedId: bed.id, bedName: bed.name, therapistId: therapist.id, therapistName: therapist.fullName },
    idempotent: !changed,
  });
}
