"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Hourglass } from "lucide-react";
import { useWalletLedger } from "@/lib/wallet-ledger";

function countdown(startedAt: string | undefined, durationMin: number | undefined, now: number) {
  if (!startedAt || !durationMin) return "Đang tính giờ";
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const remaining = Math.max(0, durationMin * 60 - elapsed);
  if (remaining === 0) return "Đã đủ thời lượng";
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return `Còn ${[hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":")}`;
}

export function ActiveServiceBanner() {
  const entries = useWalletLedger();
  const [now, setNow] = useState(() => Date.now());
  const active = useMemo(
    () => entries.filter((entry) => entry.serviceStatus === "IN_SERVICE" && !entry.checkoutRequestedAt && entry.bookingCode),
    [entries],
  );

  useEffect(() => {
    if (!active.length) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active.length]);

  const primary = active[0];
  if (!primary?.bookingCode) return null;
  const href = primary.isBusiness
    ? `/doanh-nghiep/${encodeURIComponent(primary.bookingCode)}`
    : "/don-cua-toi?tab=upcoming";

  return (
    <div className="sticky top-14 z-30 border-b border-[#e8d2c4] bg-[#fbf2e7]/95 px-3 py-1.5 shadow-[0_4px_14px_rgba(168,95,41,0.10)] backdrop-blur">
      <Link href={href} className="mx-auto flex max-w-3xl items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#8b2b28] to-[#a85f29] px-3 py-2 text-white shadow-sm">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Hourglass size={15} className="animate-pulse" />
          <i className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#e7c878] ring-2 ring-[#ad432f]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            {active.length > 1 ? `${active.length} dịch vụ đang chạy` : "Dịch vụ đang chạy"}
            <span className="font-mono text-[10px] font-semibold text-[#fbf2e7]">· {countdown(primary.actualCheckinTime, primary.serviceDurationMin, now)}</span>
          </span>
          <span className="block truncate text-[9px] text-white/75">{primary.label} · {primary.therapistName ?? primary.branchLabel ?? "Tâm An Center"}</span>
        </span>
        <ChevronRight size={16} className="shrink-0" />
      </Link>
    </div>
  );
}
