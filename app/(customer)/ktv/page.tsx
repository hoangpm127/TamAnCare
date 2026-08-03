import Link from "next/link";
import { Star, Users } from "lucide-react";
import { db } from "@/lib/db";
import { TherapistAvatar } from "@/components/therapist-avatar";

export const metadata = {
  title: "Đội ngũ KTV | Tâm An Care",
};

export const dynamic = "force-dynamic";

export default async function TherapistListPage() {
  const activeTherapists = await db.therapist.findMany({
    where: { status: "ACTIVE", onlineBooking: true, profileApprovalStatus: "APPROVED" },
    include: { branch: { select: { name: true } } },
    orderBy: [{ ratingAvg: "desc" }, { servedCount: "desc" }, { fullName: "asc" }],
  });

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <div className="mb-1 flex items-center gap-2">
        <Users className="text-[#9f1d20]" size={20} />
        <h1 className="text-xl font-semibold tracking-tight">Đội ngũ KTV</h1>
      </div>
      <p className="mb-2.5 text-sm text-[#665b55]">Xem hồ sơ, tay nghề và đánh giá thật trước khi đặt lịch.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {activeTherapists.map((therapist) => (
          <Link
            key={therapist.id}
            href={`/ktv/${therapist.id}`}
            className="flex items-start gap-3 rounded-xl border border-[#eadbd1] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <TherapistAvatar id={therapist.id} src={therapist.avatarUrl} size={56} className="shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">{therapist.fullName}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8a7a72]">
                <Star size={12} className="fill-[#9f1d20] text-[#9f1d20]" /> {therapist.ratingAvg.toFixed(1)} · {therapist.servedCount} buổi ·{" "}
                {therapist.branch.name.replace(/^Tâm An Care · /, "")} · {therapist.shiftLabel}
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#665b55]">{therapist.publicBio ?? `Chuyên ${(therapist.publicStrengths.length ? therapist.publicStrengths : therapist.skills).join(" · ")}`}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
