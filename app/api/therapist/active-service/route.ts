import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role !== "THERAPIST") {
    return NextResponse.json({ error: "Bạn chưa có phiên KTV hợp lệ." }, { status: 401 });
  }
  const therapist = await therapistForSession(session);
  if (!therapist) return NextResponse.json({ services: [] });

  const bookings = await db.booking.findMany({
    where: { therapistId: therapist.id, status: "IN_SERVICE", checkedInAt: { not: null } },
    include: { customer: true, service: true, branch: true, group: true },
    orderBy: [{ checkedInAt: "asc" }, { startTime: "asc" }],
    take: 8,
  });

  return NextResponse.json({
    services: bookings.map((booking) => ({
      bookingCode: booking.bookingCode,
      referenceCode: booking.group?.referenceCode ?? booking.bookingCode,
      customerName: booking.customer.fullName,
      serviceName: booking.service.name,
      branchLabel: booking.branch.name.replace(/^Tâm An Care · /, ""),
      startedAt: booking.checkedInAt!.toISOString(),
      durationMin: booking.durationMin,
      plannedEndAt: new Date(booking.checkedInAt!.getTime() + booking.durationMin * 60_000).toISOString(),
      totalAmount: booking.group?.totalAmount ?? booking.totalAmount,
      paidAmount: booking.group?.paidAmount ?? booking.paidAmount,
      dueAmount: Math.max(0, (booking.group?.totalAmount ?? booking.totalAmount) - (booking.group?.paidAmount ?? booking.paidAmount)),
      usedPackage: Boolean(booking.customerPackageId),
    })),
  });
}
