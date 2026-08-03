import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, CalendarCheck, ChevronLeft, ShieldCheck, Sparkles, Star, UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { resourceStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";
import { TherapistAvatar } from "@/components/therapist-avatar";

export const dynamic = "force-dynamic";

// Avoid a second concurrent database read from generateMetadata. The local
// PGlite demo database uses one connection, while the page itself provides the
// authoritative therapist name and all public details.
export const metadata: Metadata = { title: "Hồ sơ KTV | Tâm An Center" };

export default async function TherapistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const therapist = await db.therapist.findUnique({
    where: { id },
  });
  if (!therapist || therapist.status !== "ACTIVE" || !therapist.onlineBooking || therapist.profileApprovalStatus !== "APPROVED") {
    notFound();
  }

  // Keep relation reads sequential for the single-connection local runtime.
  const branch = await db.branch.findUniqueOrThrow({ where: { id: therapist.branchId }, select: { name: true } });
  const therapistServices = await db.service.findMany({
    where: { isActive: true, isOnline: true, therapists: { some: { id: therapist.id } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const reviews = await db.review.findMany({
    where: { therapistId: therapist.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const avgReviewRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : therapist.ratingAvg;
  const repeatRate = therapist.servedCount > 0 ? Math.round((therapist.repeatCount / therapist.servedCount) * 100) : 0;
  const branchName = branch.name.replace(/^Tâm An Center · /, "");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28 text-[#281b18] sm:px-6">
      <Link href="/ktv" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#c64b32]">
        <ChevronLeft size={16} /> Đội ngũ KTV
      </Link>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#231514] to-[#3d1f12] text-white shadow-lg">
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <TherapistAvatar id={therapist.id} src={therapist.avatarUrl} size={80} className="shrink-0 rounded-full ring-2 ring-white/15" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{therapist.fullName}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
              {reviews.length > 0 ? (
                <><Star size={14} className="fill-[#c59a3d] text-[#c59a3d]" /> {avgReviewRating.toFixed(1)} ({reviews.length} đánh giá)</>
              ) : "KTV mới trên hệ thống · Chưa có đánh giá"}
            </p>
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#d2ad5d]">
              {resourceStatusLabel(therapist.status)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 py-3.5 text-center text-xs">
          <div>
            <p className="text-base font-bold">{therapist.shiftLabel}</p>
            <p className="mt-0.5 text-white/70">Ca làm việc</p>
          </div>
          <div>
            <p className="text-base font-bold">{therapist.servedCount}</p>
            <p className="mt-0.5 text-white/70">Buổi đã phục vụ</p>
          </div>
          <div>
            <p className="text-base font-bold">{repeatRate}%</p>
            <p className="mt-0.5 text-white/70">Khách quay lại</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-[#c64b32]" /> Giới thiệu
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#68574f]">
          {therapist.publicBio ?? `KTV tại ${branchName}, chuyên ${therapist.skills.join(", ")}. Hồ sơ hiển thị từ dữ liệu vận hành và đánh giá sau các booking đã hoàn thành.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(therapist.publicStrengths.length ? therapist.publicStrengths : therapist.skills).map((skill) => (
            <span key={skill} className="rounded-full bg-[#f8ebe5] px-2.5 py-1 text-xs font-semibold text-[#c64b32]">
              {skill}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Award size={15} className="text-[#c64b32]" /> Chứng chỉ & đào tạo
        </h2>
        <ul className="mt-2.5 space-y-2">
          {["Đào tạo quy trình chăm sóc và an toàn Tâm An Center", "Tái kiểm định tay nghề định kỳ", "Chỉ nhận dịch vụ nằm trong kỹ năng đã được cấu hình"].map((cert) => (
            <li key={cert} className="flex items-start gap-2 text-xs leading-5 text-[#68574f]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#a85f29]" /> {cert}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4">
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck size={15} className="text-[#c64b32]" /> Dịch vụ thực hiện
        </h2>
        <div className="space-y-1.5">
          {therapistServices.map((service) => (
            <Link
              key={service.id}
              href={`/booking?service=${service.id}&therapist=${therapist.id}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-[#fcf3ed] px-3 py-2.5 text-sm transition hover:bg-[#f8ebe5]"
            >
              <span className="min-w-0 truncate font-medium">{service.name}</span>
              <span className="shrink-0 font-semibold text-[#c64b32]">{formatMoney(service.basePrice + service.therapistFee)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4">
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <UsersRound size={15} className="text-[#c64b32]" /> Đánh giá từ khách hàng
          <span className="font-normal text-[#826f66]">{reviews.length > 0 ? `(${avgReviewRating.toFixed(1)}/5)` : "(Chưa có đánh giá)"}</span>
        </h2>
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-[#eee0d6] pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Khách hàng đã xác minh</p>
                <p className="text-xs text-[#826f66]">{review.createdAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
              </div>
              <div className="mt-1 flex gap-0.5">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} size={12} className={index < review.rating ? "fill-[#c64b32] text-[#c64b32]" : "text-[#e7d6ca]"} />
                ))}
              </div>
              <p className="mt-1.5 text-sm leading-6 text-[#68574f]">
                {review.comment || "Khách đã đánh giá sau khi hoàn thành dịch vụ."}
              </p>
            </div>
          ))}
          {reviews.length === 0 ? <p className="text-sm text-[#826f66]">Chưa có đánh giá đã xác minh.</p> : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#e7d6ca] bg-white/95 p-3 backdrop-blur md:bottom-0">
        <Link
          href={`/booking?therapist=${therapist.id}`}
          className="mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white"
        >
          Đặt lịch với {therapist.fullName}
        </Link>
      </div>
    </main>
  );
}
