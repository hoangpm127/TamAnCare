import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bookingStatusLabel } from "@/lib/labels";
import { TherapistBookingActions } from "@/components/therapist-booking-actions";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

export default async function TherapistBookingPage({ params }: { params: Promise<{ bookingCode: string }> }) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role !== "THERAPIST") notFound();
  const assignedTherapist = await therapistForSession(session);
  if (!assignedTherapist) notFound();
  const { bookingCode } = await params;
  const booking = await db.booking.findUnique({
    where: { bookingCode },
    include: { customer: true, service: true, branch: true, room: true, therapist: true },
  });
  if (!booking || booking.branchId !== assignedTherapist.branchId || booking.therapistId !== assignedTherapist.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <section className="rounded-lg border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9f1d20]">Chi tiết booking</p>
        <h1 className="mt-1 text-2xl font-semibold">{booking.customer.fullName}</h1>
        <div className="mt-5 space-y-3 text-sm text-[#665b55]">
          <p>Dịch vụ: {booking.service.name}</p>
          <p>Giờ: {booking.startTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
          <p>Trạng thái: {bookingStatusLabel(booking.status)}</p>
          <p>Cơ sở / phòng: {booking.branch.name} · {booking.room?.name ?? "Chờ xếp"}</p>
          <p>Ghi chú CRM: {booking.customer.internalNote ?? "Chưa có ghi chú"}</p>
          <p>Ghi chú dịch vụ: {booking.note ?? "Không có"}</p>
        </div>
        <TherapistBookingActions bookingCode={booking.bookingCode} initialStatus={booking.status} />
        <Link href="/therapist" className="mt-5 inline-block text-sm font-semibold text-[#9f1d20]">
          Quay lại lịch ca
        </Link>
      </section>
    </div>
  );
}
