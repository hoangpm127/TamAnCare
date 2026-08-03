import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { MessageSquareText, Star } from "lucide-react";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { resourceStatusLabel } from "@/lib/labels";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { TherapistQrCard } from "@/components/therapist-qr-card";
import { createTherapistQrToken, therapistCheckinUrl } from "@/lib/server/therapist-qr";

export const dynamic = "force-dynamic";

export default async function TherapistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "therapists")) notFound();
  const therapist = await db.therapist.findFirst({
    where: { id, ...(session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" }) },
    include: { branch: true, reviews: { include: { booking: { include: { customer: true } } }, orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!therapist) notFound();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;
  const qrToken = createTherapistQrToken({ therapistId: therapist.id, branchId: therapist.branchId, version: therapist.qrVersion });
  const qrDataUrl = await QRCode.toDataURL(therapistCheckinUrl(qrToken, origin), { width: 420, margin: 1, errorCorrectionLevel: "H", color: { dark: "#173d36", light: "#ffffff" } });
  const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const therapistBookings = await db.booking.findMany({
    where: { therapistId: therapist.id, startTime: { gte: new Date(`${businessDate}T00:00:00+07:00`), lte: new Date(`${businessDate}T23:59:59+07:00`) } },
    include: { service: true, customer: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
      <section className="rounded-lg border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d13f1f]">Hồ sơ KTV</p>
        <h1 className="mt-1 text-2xl font-semibold">{therapist.fullName}</h1>
        <p className="mt-1 text-xs font-semibold text-[#d13f1f]">{therapist.branch.name}</p>
        <p className="mt-2 text-[#665b55]">{therapist.skills.join(", ")}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Metric label="Rating" value={`${therapist.ratingAvg.toFixed(1)} sao`} />
          <Metric label="Lượt phục vụ" value={therapist.servedCount} />
          <Metric label="Khách đặt lại" value={therapist.repeatCount} />
          <Metric label="Trạng thái" value={resourceStatusLabel(therapist.status)} />
        </div>
      </section>

      <div className="mt-4"><TherapistQrCard dataUrl={qrDataUrl} therapistName={therapist.fullName} branchLabel={therapist.branch.name.replace(/^Tâm An Center · /, "")} /></div>

      <section className="mt-4 rounded-xl border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageSquareText size={18} className="text-[#d13f1f]" /> Lịch sử đánh giá</h2>
            <p className="mt-1 text-xs text-[#8a7a72]">Lưu theo khách hàng và ngày trải nghiệm, không ghi đè đánh giá cũ.</p>
          </div>
          <span className="rounded-full bg-[#fff7ec] px-3 py-1.5 text-xs font-bold text-[#8a5a12]">{therapist.ratingAvg.toFixed(1)} ★ · {therapist.reviews.length} đánh giá</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {therapist.reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-[#f1e5dd] bg-[#fffaf6] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold">{review.booking.customer.fullName}</p><div className="mt-1 flex gap-0.5">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} className={index < review.rating ? "fill-[#b9862c] text-[#b9862c]" : "text-[#dfd2ca]"} />)}</div></div>
                <time className="text-[10px] text-[#8a7a72]">{review.createdAt.toLocaleDateString("vi-VN")}</time>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#665b55]">“{review.comment ?? "Khách chưa để lại nhận xét."}”</p>
            </article>
          ))}
          {therapist.reviews.length === 0 ? <p className="rounded-xl border border-dashed border-[#eadbd1] p-5 text-center text-sm text-[#8a7a72] sm:col-span-2">Chưa có đánh giá được lưu.</p> : null}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold">Lịch làm hôm nay</h2>
        <div className="mt-4 space-y-3">
          {therapistBookings.length === 0 ? (
            <div className="rounded-lg bg-[#fff7f3] p-4 text-sm text-[#665b55]">Chưa có booking hôm nay.</div>
          ) : (
            therapistBookings.map((booking) => (
              <div key={booking.id} className="rounded-lg border border-[#f2e7df] p-4">
                <p className="font-semibold">{booking.startTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-sm text-[#665b55]">{booking.customer.fullName} · {booking.service.name}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#eadbd1] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#665b55]">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
