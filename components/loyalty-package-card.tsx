import Link from "next/link";
import { ArrowRight, PackagePlus, UsersRound } from "lucide-react";
import { packagePlans } from "@/lib/demo-data";
import { cn, formatMoney } from "@/lib/utils";

export function LoyaltyPackageCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const plan = packagePlans.find((item) => item.id === "pkg-19") ?? packagePlans[0];
  const totalSessions = plan.paidSessions + plan.bonusSessions;

  if (compact) {
    return (
      <Link
        href="/uu-dai?plan=pkg-19"
        className={cn(
          "group relative self-start overflow-hidden rounded-xl border border-[#e3b23c] bg-gradient-to-br from-[#fff8e8] via-white to-[#fff2ef] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#e3b23c]">
            <PackagePlus size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#4a2d16]">Combo 19+3</span>
            <span className="mt-0.5 block truncate text-[9px] text-[#715943]">1 người mua · cùng dùng</span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-[#9f1d20] transition group-hover:translate-x-0.5" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#e3b23c]/35 pt-2">
          <span className="whitespace-nowrap text-sm font-bold text-[#9f1d20]">{formatMoney(plan.price)}</span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-1.5 py-1 text-[9px] text-[#8a7a72]"><UsersRound size={10} /> {totalSessions} lượt</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/uu-dai?plan=pkg-19"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-[#e3b23c] bg-gradient-to-br from-[#fff8e8] via-white to-[#fff2ef] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#e3b23c]/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#e3b23c]">
          <PackagePlus size={17} />
        </span>
        <span className="rounded-full bg-[#5c3a1e] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#f5d982]">Khách thân thiết</span>
      </div>
      <p className="relative mt-3 text-sm font-bold leading-5 text-[#4a2d16]">Combo tập thể 19+3</p>
      <p className="relative mt-1 text-xs leading-5 text-[#715943]">1 người mua, gia đình hoặc tập thể cùng dùng · tự trừ buổi khi check-in.</p>
      <div className="relative mt-3 flex items-end justify-between gap-3 border-t border-[#e3b23c]/35 pt-2.5">
        <span>
          <span className="block text-base font-bold text-[#9f1d20]">{formatMoney(plan.price)}</span>
          <span className="flex items-center gap-1 text-[10px] text-[#8a7a72]">
            <UsersRound size={11} /> {totalSessions} lượt dùng chung
          </span>
        </span>
        <ArrowRight size={16} className="mb-1 shrink-0 text-[#9f1d20] transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
