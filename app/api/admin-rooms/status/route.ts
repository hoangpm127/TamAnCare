import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FacilityLiveStatus } from "@/lib/facility";
import { getAdminSession } from "@/lib/server/admin-session";
import { vietnamWorkDate } from "@/lib/server/facility-operations";

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;

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
    start: new Date(`${date}T00:00:00+07:00`),
    end: new Date(`${date}T23:59:59.999+07:00`),
  };
}

function bookingView(booking: {
  id: string;
  branchId: string;
  bookingCode: string;
  status: string;
  startTime: Date;
  endTime: Date;
  checkedInAt: Date | null;
  completedAt: Date | null;
  durationMin: number;
  roomId: string | null;
  therapistId: string | null;
  customer: { fullName: string; phone: string };
  service: { id: string; name: string; category: string };
  therapist: { fullName: string } | null;
}) {
  const expectedEndAt = booking.status === "IN_SERVICE" && booking.checkedInAt
    ? addMinutes(booking.checkedInAt, booking.durationMin)
    : booking.endTime;
  return {
    id: booking.id,
    branchId: booking.branchId,
    bookingCode: booking.bookingCode,
    customerName: booking.customer.fullName,
    customerPhone: booking.customer.phone,
    serviceId: booking.service.id,
    serviceName: booking.service.name,
    serviceCategory: booking.service.category,
    therapistId: booking.therapistId,
    therapistName: booking.therapist?.fullName ?? "Chưa xếp KTV",
    bedId: booking.roomId,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    expectedEndAt: expectedEndAt.toISOString(),
    status: booking.status,
    checkedInAt: booking.checkedInAt?.toISOString() ?? null,
    completedAt: booking.completedAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Không có quyền xem sơ đồ vận hành cơ sở." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedBranch = url.searchParams.get("branchId");
  const requestedAt = url.searchParams.get("at");
  const selectedAt = requestedAt ? new Date(requestedAt) : new Date();
  if (Number.isNaN(selectedAt.getTime())) return NextResponse.json({ error: "Thời điểm xem sơ đồ không hợp lệ." }, { status: 400 });

  const branchId = session.role === "OWNER" ? requestedBranch || undefined : session.branchId ?? "__none__";
  const branchWhere = session.role === "OWNER" ? (branchId ? { id: branchId } : {}) : { id: branchId };
  const resourceWhere = branchId ? { branchId } : {};
  const day = businessDayRange(selectedAt);
  const workDate = vietnamWorkDate(selectedAt);
  const canConfigure = ["OWNER", "BRANCH_MANAGER"].includes(session.role);

  const [branches, floors, unassignedBeds, bookings, therapists] = await Promise.all([
    db.branch.findMany({
      where: branchWhere,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, seatCapacity: true, bufferMinutes: true },
    }),
    db.facilityFloor.findMany({
      where: { ...(branchId ? { branchId } : {}), ...(!canConfigure ? { status: { not: "HIDDEN" as const } } : {}) },
      orderBy: [{ branchId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        rooms: {
          where: !canConfigure ? { status: { not: "HIDDEN" as const } } : {},
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            beds: {
              where: !canConfigure ? { status: { not: "HIDDEN" as const } } : {},
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            },
          },
        },
      },
    }),
    db.room.findMany({
      where: { ...resourceWhere, facilityRoomId: null, ...(!canConfigure ? { status: { not: "HIDDEN" as const } } : {}) },
      orderBy: [{ branchId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.booking.findMany({
      where: {
        ...resourceWhere,
        roomId: { not: null },
        OR: [
          { status: { in: [...ACTIVE_BOOKING_STATUSES] }, startTime: { lte: day.end }, endTime: { gte: day.start } },
          { status: "COMPLETED", completedAt: { gte: addMinutes(day.start, -120), lte: day.end } },
        ],
      },
      include: { customer: true, service: true, therapist: { select: { fullName: true } } },
      orderBy: { startTime: "asc" },
    }),
    db.therapist.findMany({
      where: { ...resourceWhere, status: { not: "HIDDEN" } },
      orderBy: [{ branchId: "asc" }, { fullName: "asc" }],
      include: {
        services: { select: { id: true } },
        weeklySchedules: { where: { isActive: true }, select: { weekday: true, startMinute: true, endMinute: true, isActive: true } },
        attendanceRecords: { where: { workDate }, take: 1 },
        bookings: {
          where: { status: { in: [...ACTIVE_BOOKING_STATUSES] }, startTime: { lte: day.end }, endTime: { gte: day.start } },
          include: { customer: { select: { fullName: true } }, service: { select: { name: true } }, room: { select: { name: true } } },
          orderBy: { startTime: "asc" },
        },
      },
    }),
  ]);

  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
  const mappedBed = (bed: (typeof unassignedBeds)[number], floorStatus: string, roomStatus: string) => {
    const bedBookings = bookings.filter((booking) => booking.roomId === bed.id);
    const inService = bedBookings.find((booking) => booking.status === "IN_SERVICE");
    const checkedIn = bedBookings.find((booking) => booking.status === "CHECKED_IN");
    const reserved = bedBookings.find((booking) => ["PENDING", "CONFIRMED"].includes(booking.status) && booking.startTime <= selectedAt && booking.endTime > selectedAt);
    const cleaning = bedBookings.find((booking) => booking.status === "COMPLETED" && booking.completedAt && booking.completedAt <= selectedAt && addMinutes(booking.completedAt, branchesById.get(bed.branchId)?.bufferMinutes ?? 15) > selectedAt);
    const current = inService ?? checkedIn ?? reserved;
    const liveStatus: FacilityLiveStatus = bed.status !== "ACTIVE" || floorStatus !== "ACTIVE" || roomStatus !== "ACTIVE"
      ? "MAINTENANCE"
      : inService
        ? "IN_SERVICE"
        : checkedIn
          ? "CHECKED_IN"
          : reserved
            ? "RESERVED"
            : cleaning
              ? "CLEANING"
              : "AVAILABLE";
    const next = bedBookings.find((booking) => ["PENDING", "CONFIRMED"].includes(booking.status) && booking.startTime > selectedAt);
    return {
      id: bed.id,
      branchId: bed.branchId,
      facilityRoomId: bed.facilityRoomId,
      name: bed.name,
      type: bed.type,
      status: bed.status,
      suitableCategories: bed.suitableCategories,
      sortOrder: bed.sortOrder,
      note: bed.note,
      liveStatus,
      currentBooking: current ? bookingView(current) : null,
      cleaningBooking: !current && cleaning ? bookingView(cleaning) : null,
      nextBooking: next ? bookingView(next) : null,
    };
  };

  const floorViews = floors.map((floor) => ({
    id: floor.id,
    branchId: floor.branchId,
    name: floor.name,
    status: floor.status,
    sortOrder: floor.sortOrder,
    note: floor.note,
    virtual: false,
    rooms: floor.rooms.map((room) => ({
      id: room.id,
      floorId: room.floorId,
      name: room.name,
      status: room.status,
      sortOrder: room.sortOrder,
      note: room.note,
      virtual: false,
      beds: room.beds.map((bed) => mappedBed(bed, floor.status, room.status)),
    })),
  }));

  for (const branch of branches) {
    const legacy = unassignedBeds.filter((bed) => bed.branchId === branch.id);
    if (!legacy.length) continue;
    floorViews.push({
      id: `virtual-floor:${branch.id}`,
      branchId: branch.id,
      name: "Chưa phân tầng",
      status: "MAINTENANCE",
      sortOrder: 999,
      note: "Cần chuyển các giường cũ vào tầng và phòng thật.",
      virtual: true,
      rooms: [{
        id: `virtual-room:${branch.id}`,
        floorId: `virtual-floor:${branch.id}`,
        name: "Chưa phân phòng",
        status: "MAINTENANCE",
        sortOrder: 999,
        note: "Cần cấu hình mặt bằng.",
        virtual: true,
        beds: legacy.map((bed) => mappedBed(bed, "MAINTENANCE", "MAINTENANCE")),
      }],
    });
  }

  const therapistViews = therapists.map((therapist) => {
    const attendance = therapist.attendanceRecords[0] ?? null;
    const currentBooking = therapist.bookings.find((booking) => booking.status === "IN_SERVICE")
      ?? therapist.bookings.find((booking) => booking.status === "CHECKED_IN")
      ?? null;
    const nextBooking = therapist.bookings.find((booking) => booking.startTime > selectedAt && ["PENDING", "CONFIRMED"].includes(booking.status)) ?? null;
    return {
      id: therapist.id,
      branchId: therapist.branchId,
      fullName: therapist.fullName,
      status: therapist.status,
      serviceIds: therapist.services.map((service) => service.id),
      schedules: therapist.weeklySchedules,
      attendance: attendance ? {
        id: attendance.id,
        status: attendance.status,
        checkInAt: attendance.checkInAt?.toISOString() ?? null,
        checkOutAt: attendance.checkOutAt?.toISOString() ?? null,
        lateMinutes: attendance.lateMinutes,
        note: attendance.note,
      } : null,
      liveBooking: currentBooking ? {
        bookingCode: currentBooking.bookingCode,
        customerName: currentBooking.customer.fullName,
        serviceName: currentBooking.service.name,
        bedName: currentBooking.room?.name ?? "Chưa xếp giường",
        status: currentBooking.status,
      } : null,
      nextBooking: nextBooking ? {
        bookingCode: nextBooking.bookingCode,
        customerName: nextBooking.customer.fullName,
        startTime: nextBooking.startTime.toISOString(),
      } : null,
    };
  });

  const waitingBookings = bookings
    .filter((booking) => ["CONFIRMED", "CHECKED_IN"].includes(booking.status))
    .map(bookingView);
  const allBeds = floorViews.flatMap((floor) => floor.rooms.flatMap((room) => room.beds));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    selectedAt: selectedAt.toISOString(),
    canConfigure,
    branches: branches.map((branch) => ({
      id: branch.id,
      label: branch.name.replace(/^Tâm An Center · /, ""),
      seatCapacity: branch.seatCapacity,
    })),
    floors: floorViews,
    therapists: therapistViews,
    waitingBookings,
    summary: {
      total: allBeds.filter((bed) => bed.status !== "HIDDEN").length,
      available: allBeds.filter((bed) => bed.liveStatus === "AVAILABLE").length,
      reserved: allBeds.filter((bed) => bed.liveStatus === "RESERVED").length,
      checkedIn: allBeds.filter((bed) => bed.liveStatus === "CHECKED_IN").length,
      inService: allBeds.filter((bed) => bed.liveStatus === "IN_SERVICE").length,
      cleaning: allBeds.filter((bed) => bed.liveStatus === "CLEANING").length,
      maintenance: allBeds.filter((bed) => bed.liveStatus === "MAINTENANCE").length,
    },
  });
}
