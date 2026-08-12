import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { activeBedWhere } from "@/lib/server/facility-operations";

function dateAt(value: string | null, end = false) {
  if (!value) return null;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}+07:00`);
}

function inDayPart(value: Date, dayPart: string) {
  if (dayPart === "all") return true;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(value));
  if (dayPart === "morning") return hour < 12;
  if (dayPart === "afternoon") return hour >= 12 && hour < 18;
  return hour >= 18;
}

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem vận hành." }, { status: 403 });
  if (session.role !== "OWNER" && !session.branchId) {
    return NextResponse.json({ error: "Tài khoản chưa được gán cơ sở vận hành." }, { status: 403 });
  }
  const url = new URL(request.url);
  const start = dateAt(url.searchParams.get("from")) ?? new Date(Date.now() - 7 * 86_400_000);
  const end = dateAt(url.searchParams.get("to"), true) ?? new Date();
  const requestedBranch = url.searchParams.get("branchId");
  const branchId = session.role === "OWNER"
    ? (requestedBranch && requestedBranch !== "all" ? requestedBranch : undefined)
    : session.branchId!;
  const dayPart = url.searchParams.get("dayPart") ?? "all";

  const [branchRecords, rawBookings, therapists, rooms] = await Promise.all([
    db.branch.findMany({ where: branchId ? { id: branchId } : {}, orderBy: { id: "asc" } }),
    db.booking.findMany({
      where: { ...(branchId ? { branchId } : {}), startTime: { gte: start, lte: end } },
      include: { customer: true, branch: true, service: true, therapist: true, room: true },
      orderBy: { startTime: "asc" },
    }),
    db.therapist.findMany({ where: { ...(branchId ? { branchId } : {}), status: "ACTIVE" } }),
    db.room.findMany({ where: { ...(branchId ? { branchId } : {}) }, include: { facilityRoom: { include: { floor: true } } } }),
  ]);
  const bookings = rawBookings.filter((item) => inDayPart(item.startTime, dayPart));
  const operationalBookings = bookings.filter((item) => !["CANCELLED", "NO_SHOW"].includes(item.status));
  const customerIds = new Set(bookings.map((item) => item.customerId));
  const customers = [...new Map(bookings.map((item) => [item.customerId, item.customer])).values()];
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const availableMinutes = branchRecords.reduce((sum, branch) => sum + branch.seatCapacity * 15 * 60 * days, 0);
  const therapistMinutes = Math.max(1, therapists.length * 15 * 60 * days);
  const bookedMinutes = operationalBookings.reduce((sum, item) => sum + item.durationMin, 0);
  const statusCounts = bookings.reduce<Record<string, number>>((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, {});
  const expectedRevenue = operationalBookings.reduce((sum, item) => sum + item.totalAmount, 0);

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString(), dayPart },
    bookingCount: bookings.length,
    statusCounts,
    expectedRevenue,
    customerCount: customerIds.size,
    customerSegments: {
      new: customers.filter((item) => item.segment === "NEW").length,
      returning: customers.filter((item) => item.segment === "RETURNING").length,
      vip: customers.filter((item) => ["VIP", "LOYAL", "LONG_TERM"].includes(item.segment)).length,
    },
    seatCapacity: branchRecords.reduce((sum, item) => sum + item.seatCapacity, 0),
    activeTherapists: therapists.length,
    activeRooms: await db.room.count({ where: { ...(branchId ? { branchId } : {}), AND: [activeBedWhere()] } }),
    maintenanceRooms: rooms.filter((item) => item.status !== "HIDDEN" && (item.status !== "ACTIVE" || item.facilityRoom?.status !== "ACTIVE" || item.facilityRoom?.floor.status !== "ACTIVE")).length,
    roomUtilization: availableMinutes ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)) : 0,
    therapistUtilization: Math.min(100, Math.round((bookedMinutes / therapistMinutes) * 100)),
    averageRating: therapists.length ? therapists.reduce((sum, item) => sum + item.ratingAvg, 0) / therapists.length : 0,
    servedCount: therapists.reduce((sum, item) => sum + item.servedCount, 0),
    branchBreakdown: branchRecords.map((branch) => {
      const scoped = bookings.filter((item) => item.branchId === branch.id);
      return {
        branchId: branch.id,
        bookingCount: scoped.length,
        expectedRevenue: scoped.filter((item) => !["CANCELLED", "NO_SHOW"].includes(item.status)).reduce((sum, item) => sum + item.totalAmount, 0),
        customerCount: new Set(scoped.map((item) => item.customerId)).size,
      };
    }),
    bookings: bookings.map((item) => ({
      id: item.id,
      bookingCode: item.bookingCode,
      customerName: item.customer.fullName,
      customerPhone: item.customer.phone,
      serviceLabel: item.service.name,
      therapistName: item.therapist?.fullName ?? "Cơ sở sắp xếp",
      roomName: item.room?.name ?? "Chờ xếp",
      branchId: item.branchId,
      branchLabel: item.branch.name.replace(/^Tâm An Center · /, ""),
      startTime: item.startTime.toISOString(),
      status: item.status,
      totalAmount: item.totalAmount,
      depositAmount: item.depositAmount,
    })),
  });
}
