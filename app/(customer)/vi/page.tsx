"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CalendarCheck2, ChevronRight, CircleDollarSign, LayoutGrid, ListTree, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useReferralSummary } from "@/lib/referral-store";
import { calculateWalletTotalExpense, useWalletLedger } from "@/lib/wallet-ledger";
import { useExpandToggle } from "@/lib/use-expand-toggle";
import { cn, formatMoney } from "@/lib/utils";
import { BillCard, ExpenseSection, useUnusedBills } from "./expense-section";
import { IncomeSection } from "./income-section";

export default function WalletPage() {
  const referral = useReferralSummary();
  const [tab, setTab] = useState<"thu" | "chi">("thu");
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview");

  const ledgerEntries = useWalletLedger();
  const unusedBills = useUnusedBills();
  const { isExpanded: isPendingPreviewExpanded, toggle: togglePendingPreview } = useExpandToggle(true);
  const [showPendingPreview, setShowPendingPreview] = useState(false);

  const totalIncome = referral.totalEarned;
  const totalExpense = calculateWalletTotalExpense(ledgerEntries);
  const net = totalIncome - totalExpense;
  const offsetPercent = totalExpense > 0 ? Math.round((totalIncome / totalExpense) * 100) : 0;

  const pendingCount = unusedBills.length;
  const inServiceCount = new Set(
    ledgerEntries.filter((entry) => entry.serviceStatus === "IN_SERVICE").map((entry) => entry.bookingCode),
  ).size;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <CircleDollarSign className="shrink-0 text-[#9f1d20]" size={22} />
        <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight">Thu - Chi của tôi</h1>
        <Link href="/don-cua-toi?tab=upcoming" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff2ef] px-3 py-2 text-xs font-semibold text-[#9f1d20] ring-1 ring-[#eadbd1]">
          <CalendarCheck2 size={14} /> Đơn của tôi{pendingCount > 0 ? ` · ${pendingCount}` : ""} <ChevronRight size={13} />
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#231514] to-[#3d1f12] text-white shadow-lg">
        <div className="grid grid-cols-2 divide-x divide-white/10 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="pr-3 text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8fd3a8]">
              <ArrowUpCircle size={13} /> Tổng Thu
            </p>
            <p className="mt-1.5 text-xl font-bold sm:text-2xl">{formatMoney(totalIncome)}</p>
          </div>
          <div className="pl-3 text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#f4c2b6]">
              <ArrowDownCircle size={13} /> Tổng Chi
            </p>
            <p className="mt-1.5 text-xl font-bold sm:text-2xl">{formatMoney(totalExpense)}</p>
          </div>
        </div>
        {pendingCount > 0 || inServiceCount > 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 pb-3.5 pt-3 sm:px-5">
            {inServiceCount > 0 ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#9f1d20] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9f1d20]" /> {inServiceCount} đang phục vụ
              </span>
            ) : null}
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowPendingPreview((value) => !value)}
                aria-expanded={showPendingPreview}
                className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#e3b23c] px-3 py-2 text-[11px] font-bold text-[#231514] shadow-sm sm:w-auto sm:min-w-64"
              >
                {pendingCount} lịch đã cọc/chưa hoàn tất, bấm để xem
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="border-t border-white/10 px-4 py-3.5 text-center sm:px-5">
          <p className="text-xs text-white/70">Chênh lệch Thu - Chi</p>
          <p className={cn("text-lg font-bold", net >= 0 ? "text-[#8fd3a8]" : "text-[#f4c2b6]")}>
            {net >= 0 ? "+" : ""}
            {formatMoney(net)}
          </p>
        </div>
        <div className="flex items-start gap-2.5 border-t border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/85 sm:px-5">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-[#e3b23c]" />
          <p>
            Thu nhập Affiliate đã bù đắp <strong className="text-white">{offsetPercent}%</strong> chi phí trải nghiệm của bạn tại Tuệ
            Tâm{net >= 0 ? " — đi massage mà vẫn mang tiền về!" : "."}
          </p>
        </div>
      </section>

      {showPendingPreview && unusedBills.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {unusedBills.map((bill) => (
            <BillCard
              key={bill.key}
              data={bill}
              expanded={isPendingPreviewExpanded(bill.key)}
              onToggle={() => togglePendingPreview(bill.key)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadbd1] bg-white shadow-sm">
        <div className="grid grid-cols-2 gap-2 border-b border-dashed border-[#f1e5dd] p-2">
          <button
            type="button"
            onClick={() => setViewMode("overview")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition",
              viewMode === "overview"
                ? "bg-gradient-to-b from-[#b32228] to-[#8f151a] text-white shadow-sm"
                : "border border-[#dcc7bb] bg-[#f3e5dc] text-[#5c3a1e]"
            )}
          >
            <LayoutGrid size={13} /> Tổng quan
          </button>
          <button
            type="button"
            onClick={() => setViewMode("detailed")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition",
              viewMode === "detailed"
                ? "bg-gradient-to-b from-[#b32228] to-[#8f151a] text-white shadow-sm"
                : "border border-[#dcc7bb] bg-[#f3e5dc] text-[#5c3a1e]"
            )}
          >
            <ListTree size={13} /> Chi tiết
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <button
            type="button"
            onClick={() => setTab("thu")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition",
              tab === "thu" ? "bg-[#1d8f55] text-white shadow-sm" : "bg-[#fdf8f5] text-[#4d403a]"
            )}
          >
            <TrendingUp size={16} /> Thu nhập
          </button>
          <button
            type="button"
            onClick={() => setTab("chi")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition",
              tab === "chi" ? "bg-[#9f1d20] text-white shadow-sm" : "bg-[#fdf8f5] text-[#4d403a]"
            )}
          >
            <TrendingDown size={16} /> Chi tiêu
          </button>
        </div>
      </div>

      {tab === "thu" ? <IncomeSection detailed={viewMode === "detailed"} /> : <ExpenseSection detailed={viewMode === "detailed"} />}
    </main>
  );
}
