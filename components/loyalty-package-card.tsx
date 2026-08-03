import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";
import { packagePlans } from "@/lib/demo-data";
import { cn, formatMoney } from "@/lib/utils";

export function LoyaltyPackageCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const plan = packagePlans.find((item) => item.id === "pkg-body-15") ?? packagePlans[0];
  const totalSessions = plan.paidSessions + plan.bonusSessions;

  if (compact) {
    return (
      <Link
        href={`/uu-dai?plan=${plan.id}`}
        className={cn(
          "group relative self-start overflow-hidden rounded-xl border border-[#c59a3d] bg-gradient-to-br from-[#fff8e8] via-white to-[#f8ebe5] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#c59a3d]">
            <PackagePlus size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#4a2d16]">Đồng hành Body 15+2</span>
            <span className="mt-0.5 block truncate text-[9px] text-[#715943]">17 buổi · hiệu lực 240 ngày</span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-[#c64b32] transition group-hover:translate-x-0.5" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#c59a3d]/35 pt-2">
          <span className="whitespace-nowrap text-sm font-bold text-[#c64b32]">{formatMoney(plan.price)}</span>
          <span className="shrink-0 rounded-full bg-white px-1.5 py-1 text-[9px] text-[#826f66]">{totalSessions} buổi</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/uu-dai?plan=${plan.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-[#c59a3d] bg-gradient-to-br from-[#fff8e8] via-white to-[#f8ebe5] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#c59a3d]/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#c59a3d]">
          <PackagePlus size={17} />
        </span>
        <span className="rounded-full bg-[#5c3a1e] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#e7c878]">Khách thân thiết</span>
      </div>
      <p className="relative mt-3 text-sm font-bold leading-5 text-[#4a2d16]">Đồng hành Body 15+2</p>
      <p className="relative mt-1 text-xs leading-5 text-[#715943]">Mua 15 tặng 2 · dành riêng cho chủ thẻ · tự trừ buổi khi check-in.</p>
      <div className="relative mt-3 flex items-end justify-between gap-3 border-t border-[#c59a3d]/35 pt-2.5">
        <span>
          <span className="block text-base font-bold text-[#c64b32]">{formatMoney(plan.price)}</span>
          <span className="flex items-center gap-1 text-[10px] text-[#826f66]">
            {totalSessions} buổi · hiệu lực {plan.validityDays} ngày
          </span>
        </span>
        <ArrowRight size={16} className="mb-1 shrink-0 text-[#c64b32] transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
