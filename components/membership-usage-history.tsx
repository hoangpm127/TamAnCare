"use client";

import { History } from "lucide-react";
import { useMembership } from "@/lib/membership";

export function MembershipUsageHistory() {
  const membership = useMembership();

  if (!membership || membership.usageHistory.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2.5 px-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7a72]">
        <History size={13} /> Lịch sử sử dụng thẻ
      </p>
      <div className="overflow-hidden rounded-xl border border-[#eadbd1] bg-white shadow-sm">
        {membership.usageHistory.map((entry, index) => (
          <div
            key={`${entry.date}-${entry.time}-${index}`}
            className="flex items-center justify-between gap-3 border-b border-[#f1e5dd] px-4 py-3 last:border-b-0"
          >
            <span className="text-sm font-medium">
              {entry.status === "RESERVED" ? "Đang giữ lịch" : "Đã sử dụng"} · {membership.planName}
            </span>
            <span className="shrink-0 text-xs text-[#8a7a72]">
              {entry.date} · {entry.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
