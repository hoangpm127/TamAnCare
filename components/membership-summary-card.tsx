"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, PackagePlus } from "lucide-react";
import { useMembership } from "@/lib/membership";

export function MembershipSummaryCard() {
  const membership = useMembership();

  if (!membership) {
    return (
      <Link
        href="/uu-dai"
        className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#c59a3d]/60 bg-[#fbf2e7] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#c59a3d]">
          <PackagePlus size={18} />
        </span>
        <span className="flex flex-1 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Chưa có thẻ thành viên</span>
            <span className="mt-0.5 block text-xs text-[#826f66]">Mua gói dài hạn để nhận ưu đãi tốt nhất</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" />
        </span>
      </Link>
    );
  }

  const remaining = membership.availableSessions;
  const progress = Math.round((membership.usedSessions / membership.totalSessions) * 100);

  return (
    <Link
      href="/don-cua-toi?tab=upcoming"
      className="mt-4 block overflow-hidden rounded-xl bg-gradient-to-br from-[#231514] to-[#3d1f12] p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c59a3d]">
          <CreditCard size={14} /> Thẻ thành viên
        </span>
        {membership.badge ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#c59a3d]">{membership.badge}</span>
        ) : null}
      </div>
      <p className="mt-2 text-base font-semibold">{membership.planName}</p>
      <div className="mt-2.5 flex items-center justify-between text-xs text-white/75">
        <span>
          Còn {remaining}/{membership.totalSessions} buổi
        </span>
        <span>HSD {membership.expiresAt}</span>
      </div>
      {membership.reservedSessions > 0 ? (
        <p className="mt-2 text-[11px] text-white/60">{membership.reservedSessions} lượt đang giữ cho lịch sắp tới</p>
      ) : null}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#c59a3d]" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}
