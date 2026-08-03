import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";

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

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || ["THERAPIST", "INVESTOR"].includes(session.role)) {
    return NextResponse.json({ error: "Không có quyền xem trạng thái phòng và giường." }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedBranch = url.searchParams.get("branchId");
  const requestedAt = url.searchParams.get("at");
  const selectedAt = requestedAt ? new Date(requestedAt) : new Date();
  if (Number.isNaN(selectedAt.getTime())) {
    return NextResponse.json({ error: "Thời điểm xem sơ đồ không hợp lệ." }, { status: 400 });
  }
  const branchId = session.role === "OWNER" ? requestedBranch || undefined : session.branchId ?? "__none__";
  const branchListWhere = session.role === "OWNER" ? {} : { id: branchId };
  const now = new Date();
  const day = businessDayRange(selectedAt);
  const [branches, rooms, bookings] = await Promise.all([
    db.branch.findMany({
      where: branchListWhere,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, seatCapacity: true },
    }),
    db.room.findMany({
      where: { ...(branchId ? { branchId } : {}), status: { not: "HIDDEN" } },
      orderBy: [{ branchId: "asc" }, { name: "asc" }],
      select: { id: true, branchId: true, name: true, type: true, status: true, note: true },
    }),
    db.booking.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        roomId: { not: null },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startTime: { lte: day.end },
        endTime: { gte: day.start },
      },
      include: { customer: true, service: true, therapist: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    selectedAt: selectedAt.toISOString(),
    branches: branches.map((branch) => ({
      id: branch.id,
      label: branch.name.replace(/^Tâm An Care · /, ""),
      seatCapacity: branch.seatCapacity,
    })),
    rooms: rooms.map((room) => {
      const roomBookings = bookings.filter((booking) => booking.roomId === room.id);
      const current = roomBookings.find((booking) => booking.startTime <= selectedAt && booking.endTime > selectedAt);
      const next = roomBookings.find((booking) => booking.startTime > selectedAt);
      return {
        ...room,
        liveStatus: room.status !== "ACTIVE" ? "MAINTENANCE" : current ? "BUSY" : "AVAILABLE",
        currentBooking: current ? {
          customerName: current.customer.fullName,
          serviceName: current.service.name,
          therapistName: current.therapist?.fullName ?? "Cơ sở sắp xếp",
          startTime: current.startTime.toISOString(),
          endTime: current.endTime.toISOString(),
          status: current.status,
        } : null,
        nextBooking: next ? {
          customerName: next.customer.fullName,
          startTime: next.startTime.toISOString(),
        } : null,
      };
    }),
  });
}
