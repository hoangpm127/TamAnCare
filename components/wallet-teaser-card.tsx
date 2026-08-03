"use client";

import Link from "next/link";
import { ChevronRight, CircleDollarSign } from "lucide-react";
import { useReferralSummary } from "@/lib/referral-store";
import { calculateWalletTotalExpense, useWalletLedger } from "@/lib/wallet-ledger";
import { cn, formatMoney } from "@/lib/utils";

export function WalletTeaserCard() {
  const referral = useReferralSummary();
  const ledgerEntries = useWalletLedger();
  const totalExpense = calculateWalletTotalExpense(ledgerEntries);
  const walletNet = referral.totalEarned - totalExpense;

  return (
    <Link
      href="/vi"
      className="mt-4 flex items-center gap-3 rounded-xl border border-[#e7d6ca] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]">
        <CircleDollarSign size={20} />
      </span>
      <span className="flex flex-1 items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">Thu - Chi của tôi</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs">
            <span className="text-[#a85f29]">Thu {formatMoney(referral.totalEarned)}</span>
            <span className="text-[#826f66]">·</span>
            <span className={cn(walletNet >= 0 ? "text-[#a85f29]" : "text-[#c64b32]")}>
              {walletNet >= 0 ? "+" : ""}
              {formatMoney(walletNet)}
            </span>
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" />
      </span>
    </Link>
  );
}
