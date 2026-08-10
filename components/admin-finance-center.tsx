"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { endOfDay, endOfMonth, endOfWeek, endOfYear, format, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  Landmark,
  ReceiptText,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useAdminSession } from "@/components/admin-session-provider";
import { CompactSelect } from "@/components/compact-select";
import { usePublicCatalog } from "@/lib/catalog-store";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year" | "custom" | "all";
type DayPart = "all" | "morning" | "afternoon" | "evening";
type DrilldownMode = "summary" | "income" | "expense" | "tip";

type ServerFinanceSummary = {
  dataQuality: {
    reportingMode: "UAT_WITH_DEMO" | "PRODUCTION_LIVE_ONLY";
    includesDemoData: boolean;
    origins: Record<"LIVE" | "IMPORTED" | "DEMO", { count: number; amount: number }>;
  };
  grossServiceRevenue: number;
  refunds: number;
  serviceRevenue: number;
  cashIn: number;
  cashOut: number;
  deposits: number;
  platformRevenue: number;
  partnerRevenue: number;
  operatingExpenses: number;
  platformFees: number;
  expenses: number;
  tips: number;
  profit: number;
  branchBreakdown: { branchId: string; label: string; grossRevenue: number; refunds: number; revenue: number; partnerRevenue: number; operatingExpenses: number; platformFees: number; expenses: number; tips: number; profit: number }[];
  bills: Array<{
    referenceCode: string;
    customerName: string;
    customerPhone: string;
    serviceLabel: string;
    therapistName: string;
    branchId: string;
    branchLabel: string;
    timeIso?: string;
    totalAmount: number;
    depositAmount: number;
    paidAmount: number;
    tipAmount: number;
    status: string;
  }>;
  expenseItems: Array<{
    id: string;
    branchId: string;
    category: string;
    description: string;
    amount: number;
    vendor?: string | null;
    evidenceUrl?: string | null;
    occurredAt: string;
  }>;
};

type FinanceBill = {
  code: string;
  customer: string;
  phone: string;
  service: string;
  therapist: string;
  branchId: string;
  branchLabel: string;
  date: Date;
  total: number;
  deposit: number;
  collected: number;
  tip: number;
  status: string;
};

export function AdminFinanceCenter() {
  const { session } = useAdminSession();
  const catalog = usePublicCatalog();
  const branches = catalog.branches;
  const [period, setPeriod] = useState<Period>("month");
  const [branchId, setBranchId] = useState("all");
  const [customerQuery, setCustomerQuery] = useState("");
  const [dayPart, setDayPart] = useState<DayPart>("all");
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBill, setSelectedBill] = useState<FinanceBill | null>(null);
  const [drilldown, setDrilldown] = useState<{ branchId: string; mode: DrilldownMode } | null>(null);
  const [serverFinance, setServerFinance] = useState<ServerFinanceSummary | null>(null);

  useEffect(() => {
    if (!session) return;
    const now = new Date();
    const range = period === "day"
      ? { start: startOfDay(now), end: endOfDay(now) }
      : period === "week"
        ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        : period === "month"
          ? { start: startOfMonth(now), end: endOfMonth(now) }
          : period === "year"
            ? { start: startOfYear(now), end: endOfYear(now) }
            : period === "custom"
              ? { start: startOfDay(parseISO(fromDate)), end: endOfDay(parseISO(toDate)) }
              : { start: new Date("2020-01-01"), end: new Date("2035-12-31") };
    const scopedBranch = session.role === "OWNER" ? branchId : session.branchId ?? "all";
    const query = new URLSearchParams({ from: format(range.start, "yyyy-MM-dd"), to: format(range.end, "yyyy-MM-dd"), branchId: scopedBranch, dayPart });
    let active = true;
    fetch(`/api/finance/summary?${query}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("finance unavailable")))
      .then((data) => { if (active) setServerFinance(data); })
      .catch(() => { if (active) setServerFinance(null); });
    return () => { active = false; };
  }, [branchId, dayPart, fromDate, period, session, toDate]);

  const allBills = useMemo<FinanceBill[]>(() => {
    const live = (serverFinance?.bills ?? []).filter((bill) => bill.timeIso).map((bill) => ({
      code: bill.referenceCode,
      customer: bill.customerName,
      phone: bill.customerPhone,
      service: bill.serviceLabel,
      therapist: bill.therapistName,
      branchId: bill.branchId,
      branchLabel: bill.branchLabel,
      date: new Date(bill.timeIso!),
      total: bill.totalAmount,
      deposit: bill.depositAmount,
      collected: bill.paidAmount,
      tip: bill.tipAmount,
      status: bill.status === "COMPLETED" ? "Đã thanh toán xong" : bill.status === "CONFIRMED" ? "Đã cọc · Đã xác nhận" : "Đã cọc · Chờ xác nhận",
    }));
    return live.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [serverFinance]);

  if (!session) return null;

  const effectiveBranch = session.role === "OWNER" ? branchId : session.branchId ?? "all";
  const now = new Date();
  const interval = period === "day"
    ? { start: startOfDay(now), end: endOfDay(now) }
    : period === "week"
      ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      : period === "month"
        ? { start: startOfMonth(now), end: endOfMonth(now) }
        : period === "year"
          ? { start: startOfYear(now), end: endOfYear(now) }
          : period === "custom"
            ? { start: startOfDay(parseISO(fromDate)), end: endOfDay(parseISO(toDate)) }
            : null;

  const matchesTime = (date: Date) => {
    if (interval && !isWithinInterval(date, interval)) return false;
    const hour = date.getHours();
    if (dayPart === "morning" && hour >= 12) return false;
    if (dayPart === "afternoon" && (hour < 12 || hour >= 18)) return false;
    if (dayPart === "evening" && hour < 18) return false;
    return true;
  };

  const filteredBills = allBills.filter((bill) => {
    if (effectiveBranch !== "all" && bill.branchId !== effectiveBranch) return false;
    if (customerQuery && !`${bill.customer} ${bill.phone} ${bill.code} ${bill.service}`.toLowerCase().includes(customerQuery.toLowerCase())) return false;
    return matchesTime(bill.date);
  });
  const filteredExpenses = (serverFinance?.expenseItems ?? []).map((entry) => ({
    ...entry,
    branchLabel: branches.find((branch) => branch.id === entry.branchId)?.label ?? (entry.branchId === "system" ? "Hệ thống" : entry.branchId),
    date: new Date(entry.occurredAt),
  })).filter((entry) => {
    if (effectiveBranch !== "all" && entry.branchId !== effectiveBranch) return false;
    if (customerQuery && !`${entry.description} ${entry.vendor ?? ""} ${entry.category}`.toLowerCase().includes(customerQuery.toLowerCase())) return false;
    return matchesTime(entry.date);
  });

  const detailedServiceRevenue = filteredBills.reduce((sum, bill) => sum + Math.min(bill.total, bill.collected), 0);
  const detailedTips = filteredBills.reduce((sum, bill) => sum + bill.tip, 0);
  const detailedExpenses = filteredExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const collected = customerQuery ? detailedServiceRevenue : serverFinance?.serviceRevenue ?? 0;
  const refunds = customerQuery ? 0 : serverFinance?.refunds ?? 0;
  const tips = customerQuery ? detailedTips : serverFinance?.tips ?? 0;
  const expenses = customerQuery ? detailedExpenses : serverFinance?.expenses ?? 0;
  const profit = collected - expenses;
  const expenseCategories = Object.entries(filteredExpenses.reduce<Record<string, number>>((result, entry) => {
    result[entry.category] = (result[entry.category] ?? 0) + entry.amount;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]);

  const branchReports = branches
    .filter((branch) => session.role === "OWNER" || branch.id === session.branchId)
    .map((branch) => {
      const bills = filteredBills.filter((bill) => bill.branchId === branch.id);
      const branchExpenses = filteredExpenses.filter((entry) => entry.branchId === branch.id).reduce((sum, entry) => sum + entry.amount, 0);
      const branchCollected = bills.reduce((sum, bill) => sum + Math.min(bill.total, bill.collected), 0);
      const branchTips = bills.reduce((sum, bill) => sum + bill.tip, 0);
      const serverBranch = serverFinance?.branchBreakdown.find((item) => item.branchId === branch.id);
      return serverBranch && !customerQuery
        ? { branch, collected: serverBranch.revenue, expenses: serverBranch.expenses, platformFees: serverBranch.platformFees, partnerRevenue: serverBranch.partnerRevenue, tips: serverBranch.tips, profit: serverBranch.profit }
        : { branch, collected: branchCollected, expenses: branchExpenses, platformFees: 0, partnerRevenue: branchCollected, tips: branchTips, profit: branchCollected - branchExpenses };
    });
  const maxBranchValue = Math.max(1, ...branchReports.map((item) => Math.max(item.collected, item.expenses)));
  const drilldownReport = drilldown
    ? drilldown.branchId === "all"
      ? { label: "Toàn hệ thống", collected, expenses, platformFees: serverFinance?.platformFees ?? 0, tips, profit }
      : (() => {
          const report = branchReports.find((item) => item.branch.id === drilldown.branchId);
          return report ? { label: report.branch.label, collected: report.collected, expenses: report.expenses, platformFees: report.platformFees, tips: report.tips, profit: report.profit } : null;
        })()
    : null;
  const drilldownBills = drilldown ? filteredBills.filter((bill) => drilldown.branchId === "all" || bill.branchId === drilldown.branchId) : [];
  const drilldownExpenses = drilldown ? filteredExpenses.filter((entry) => drilldown.branchId === "all" || entry.branchId === drilldown.branchId) : [];
  const detailedIncomeAmount = drilldownBills.reduce((sum, bill) => sum + Math.min(bill.total, bill.collected), 0);
  const aggregateIncomeAmount = Math.max(0, (drilldownReport?.collected ?? 0) - detailedIncomeAmount);
  const detailedTipAmount = drilldownBills.reduce((sum, bill) => sum + bill.tip, 0);
  const aggregateTipAmount = Math.max(0, (drilldownReport?.tips ?? 0) - detailedTipAmount);
  const detailedExpenseAmount = drilldownExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const aggregateExpenseAmount = Math.max(0, (drilldownReport?.expenses ?? 0) - detailedExpenseAmount);

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#211514] via-[#4a2616] to-[#8b2b28] p-2.5 text-white shadow-xl sm:p-3.5">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[#c59a3d]/20 blur-3xl" />
        <div className="relative px-10 text-center">
          <h1 className="whitespace-nowrap text-lg font-semibold leading-6">Trung tâm tài chính</h1>
          <p className="text-[10px] leading-3.5 text-white/75">Toàn bộ diễn biến tài chính Tâm An Center</p>
          <p className="text-[10px] italic leading-3.5 text-white/60">Bấm vào các Card để xem thêm chi tiết</p>
          {session.role === "OWNER" || session.role === "BRANCH_MANAGER" ? <Link href="/admin/refunds" aria-label="Mở trung tâm hoàn tiền" className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#e7c878] transition hover:bg-white/15"><RotateCcw size={13} /></Link> : null}
        </div>
        <div className="relative mt-2 border-t border-white/15 pt-2">
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1">
            {(["day", "week", "month", "year", "all", "custom"] as Period[]).map((value) => ({ value, label: { day: "Hôm nay", week: "Tuần này", month: "Tháng này", year: "Năm nay", all: "Tất cả", custom: "Tùy chọn" }[value] })).map((item) => (
              <button key={item.value} type="button" onClick={() => setPeriod(item.value)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold", period === item.value ? "border-[#e7c878] bg-[#e7c878] text-[#3d1f12]" : "border-white/20 bg-white/[0.06] text-white")}>{item.label}</button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <CompactSelect value={effectiveBranch} onValueChange={setBranchId} disabled={session.role !== "OWNER"} dark icon={<Building2 size={13} />} dialogTitle="Lọc theo cơ sở" triggerClassName="min-h-0 rounded-lg py-2 text-[11px]" options={[{ value: "all", label: "Tất cả cơ sở" }, ...branches.filter((branch) => session.role === "OWNER" || branch.id === session.branchId).map((branch) => ({ value: branch.id, label: branch.label }))]} />
            <CompactSelect value={dayPart} onValueChange={(next) => setDayPart(next as DayPart)} dark icon={<Clock3 size={13} />} dialogTitle="Lọc theo khung giờ" triggerClassName="min-h-0 rounded-lg py-2 text-[11px]" options={[{ value: "all", label: "Mọi khung giờ" }, { value: "morning", label: "Trước 12h" }, { value: "afternoon", label: "12h–18h" }, { value: "evening", label: "Sau 18h" }]} />
          </div>
          <label className="relative mt-1.5 block"><Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-[#e7c878]" /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Tìm khách, SĐT, dịch vụ hoặc khoản chi" className="w-full rounded-lg border border-white/15 bg-white/10 py-2 pl-8 pr-3 text-[11px] text-white placeholder:text-white/45" /></label>
          {period === "custom" ? <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-white/60">Từ ngày<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-[11px] text-white" /></label><label className="text-[10px] text-white/60">Đến ngày<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-[11px] text-white" /></label></div> : null}
        </div>
      </section>

      {serverFinance?.dataQuality.includesDemoData ? <section className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-center text-[10px] font-medium leading-4 text-amber-900">UAT đang gồm {serverFinance.dataQuality.origins.DEMO.count} bút toán mẫu. Dữ liệu mới vẫn được ghi riêng là LIVE; khi chuyển production, toàn bộ số DEMO tự động bị loại khỏi Thu–Chi và báo cáo Nhà đầu tư.</section> : null}

      <section className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: refunds > 0 ? "Doanh thu thuần" : "Doanh thu dịch vụ", value: collected, icon: WalletCards, tone: "text-[#76551d] bg-[#fbf2e7]", mode: "income" as DrilldownMode },
          { label: "Tip KTV ngoài bill", value: tips, icon: CircleDollarSign, tone: "text-[#76551d] bg-[#fff7df]", mode: "tip" as DrilldownMode },
          { label: "Tổng chi", value: expenses, icon: TrendingDown, tone: "text-[#c64b32] bg-[#f8ebe5]", mode: "expense" as DrilldownMode },
          { label: "Lãi tạm tính", value: profit, icon: TrendingUp, tone: profit >= 0 ? "text-[#76551d] bg-[#fbf2e7]" : "text-[#c64b32] bg-[#f8ebe5]", mode: "summary" as DrilldownMode },
        ].map((item) => { const Icon = item.icon; return <button type="button" onClick={() => setDrilldown({ branchId: effectiveBranch, mode: item.mode })} key={item.label} className="flex min-h-[76px] items-center gap-2.5 rounded-xl border border-[#d2ad5d]/60 bg-white p-2.5 text-left shadow-sm transition active:scale-[0.98]"><span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.tone)}><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block text-[10px] text-[#826f66]">{item.label}</span><strong className="mt-0.5 block truncate text-sm">{formatMoney(item.value)}</strong><small className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-[#c64b32]"><Eye size={10} /> Xem chi tiết</small></span></button>; })}
      </section>

      {session.role === "OWNER" ? <section className="mt-3 overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-gradient-to-br from-[#211514] to-[#4a2616] p-3.5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#e7c878]">Đối soát Xgroup & đối tác</p><h2 className="mt-0.5 text-sm font-semibold">Phân bổ doanh thu nền tảng</h2></div><Landmark size={18} className="text-[#e7c878]" /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center"><span className="rounded-xl bg-white/[0.08] p-2 text-[9px] text-white/60">Doanh thu Bill<strong className="mt-1 block text-xs text-white">{formatMoney(serverFinance?.serviceRevenue ?? 0)}</strong></span><span className="rounded-xl bg-[#e7c878]/10 p-2 text-[9px] text-[#e7c878]/75">Doanh thu nền tảng<strong className="mt-1 block text-xs text-[#e7c878]">{formatMoney(serverFinance?.platformRevenue ?? 0)}</strong></span><span className="rounded-xl bg-emerald-300/10 p-2 text-[9px] text-emerald-100/70">Doanh thu đối tác<strong className="mt-1 block text-xs text-emerald-200">{formatMoney(serverFinance?.partnerRevenue ?? 0)}</strong></span></div>
        <p className="mt-2 text-center text-[9px] leading-4 text-white/55">Phí nền tảng được ghi nhận theo khoản cọc 10% giá sau ưu đãi; phần đối tác là doanh thu Bill sau phí nền tảng, trước các chi phí vận hành khác.</p>
      </section> : null}

      <section className="mt-3 grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-[#d2ad5d]/55 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Lãi/lỗ theo cơ sở</h2><p className="mt-0.5 text-[10px] text-[#826f66]">Doanh thu dịch vụ trừ chi phí; Tip KTV theo dõi riêng.</p></div><BarChart3 size={18} className="text-[#c64b32]" /></div>
            <div className="mt-3 space-y-3">{branchReports.map((item) => (
              <div key={item.branch.id} className="rounded-xl border border-[#e7d6ca] bg-[#fdf8f3] p-3">
                <button type="button" onClick={() => setDrilldown({ branchId: item.branch.id, mode: "summary" })} className="flex w-full items-center justify-between text-left"><span><strong className="block text-xs">{item.branch.label}</strong><small className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-[#c64b32]"><Eye size={10} /> Xem chi tiết Thu–Chi</small></span><span className="text-right"><small className="block text-[9px] text-[#826f66]">Lãi tạm tính</small><strong className={cn("text-xs", item.profit >= 0 ? "text-[#76551d]" : "text-[#c64b32]")}>{formatMoney(item.profit)}</strong></span></button>
                <p className="mt-2 rounded-lg bg-[#fff7df] px-2 py-1.5 text-[9px] text-[#76551d]">Chi phí nền tảng Xgroup: <strong>{formatMoney(item.platformFees)}</strong> · Doanh thu đối tác: <strong>{formatMoney(item.partnerRevenue)}</strong></p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px]">
                  <button type="button" onClick={() => setDrilldown({ branchId: item.branch.id, mode: "income" })} className="rounded-lg bg-white p-2 text-left text-[#826f66]">Doanh thu<strong className="mt-0.5 block text-[10px] text-[#76551d]">{formatMoney(item.collected)}</strong></button>
                  <button type="button" onClick={() => setDrilldown({ branchId: item.branch.id, mode: "expense" })} className="rounded-lg bg-white p-2 text-left text-[#826f66]">Chi phí<strong className="mt-0.5 block text-[10px] text-[#c64b32]">{formatMoney(item.expenses)}</strong></button>
                  <button type="button" onClick={() => setDrilldown({ branchId: item.branch.id, mode: "tip" })} className="rounded-lg bg-white p-2 text-left text-[#826f66]">Tip KTV<strong className="mt-0.5 block text-[10px] text-[#76551d]">{formatMoney(item.tips)}</strong></button>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee0d6]"><div className="h-full rounded-full bg-gradient-to-r from-[#c64b32] via-[#9f7428] to-[#76551d]" style={{ width: `${Math.max(6, Math.round((item.collected / maxBranchValue) * 100))}%` }} /></div>
              </div>
            ))}</div>
          </div>
          <div className="rounded-xl border border-[#d2ad5d]/55 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Khoản chi gần nhất</h2><Landmark size={17} className="text-[#c64b32]" /></div>
            {expenseCategories.length ? <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto">{expenseCategories.map(([category, amount]) => <span key={category} className="shrink-0 rounded-full bg-[#f8ebe5] px-2 py-1 text-[9px] font-semibold text-[#93352d]">{category} · {formatMoney(amount)}</span>)}</div> : null}
            <div className="mt-2 space-y-2">{filteredExpenses.slice(0, 5).map((entry) => <div key={entry.id} className="flex items-start justify-between gap-2 rounded-lg bg-[#fdf8f3] p-2.5"><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{entry.description}</p><p className="mt-0.5 text-[9px] text-[#826f66]">{entry.branchLabel} · {entry.category}</p></div><strong className="shrink-0 text-[11px] text-[#c64b32]">-{formatMoney(entry.amount)}</strong></div>)}{filteredExpenses.length === 0 ? <p className="rounded-lg border border-dashed border-[#e7d6ca] p-4 text-center text-[10px] text-[#826f66]">Chưa có khoản chi đã hạch toán trong bộ lọc.</p> : null}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#d2ad5d]/55 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e7d6ca] px-3 py-2.5"><div><h2 className="text-sm font-semibold">Chi tiết từng bill</h2><p className="text-[10px] text-[#826f66]">{filteredBills.length} bill · chạm để xem đầy đủ</p></div><ReceiptText size={18} className="text-[#c64b32]" /></div>
          <div className="max-h-[620px] divide-y divide-[#eee0d6] overflow-y-auto">{filteredBills.length ? filteredBills.map((bill) => {
            const serviceCollected = Math.min(bill.total, bill.collected);
            const remaining = Math.max(0, bill.total - serviceCollected);
            return <button type="button" key={bill.code} onClick={() => setSelectedBill(bill)} className="w-full p-3 text-left transition hover:bg-[#fdf8f3]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{bill.customer} · {displayBookingCode(bill.code)}</p><p className="mt-0.5 text-[10px] text-[#826f66]">{format(bill.date, "HH:mm dd/MM/yyyy")} · {bill.branchLabel}</p></div><ChevronRight size={16} className="shrink-0 text-[#9f7428]" /></div><p className="mt-1.5 truncate text-[11px] text-[#68574f]">{bill.service}</p><div className="mt-2 grid grid-cols-3 rounded-lg bg-[#fdf8f3] px-2 py-2 text-center text-[9px] text-[#826f66]"><span>Tổng bill<strong className="mt-0.5 block text-[11px] text-[#281b18]">{formatMoney(bill.total)}</strong></span><span>{remaining ? "Đã cọc" : "Doanh thu"}<strong className="mt-0.5 block text-[11px] text-[#76551d]">{formatMoney(serviceCollected)}</strong></span><span>{remaining ? "Còn lại" : "Tip ngoài bill"}<strong className={cn("mt-0.5 block text-[11px]", remaining ? "text-[#c64b32]" : "text-[#76551d]")}>{formatMoney(remaining || bill.tip)}</strong></span></div></button>;
          }) : <div className="p-8 text-center text-xs text-[#826f66]">Không có bill phù hợp bộ lọc.</div>}</div>
        </div>
      </section>

      {drilldown && drilldownReport ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" onClick={() => setDrilldown(null)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Đóng chi tiết tài chính" />
          <section className="relative flex h-[92dvh] max-h-[760px] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[#fdf8f3] shadow-2xl sm:rounded-[2rem]">
            <div className="shrink-0 bg-gradient-to-br from-[#211514] via-[#4a2616] to-[#8b2b28] p-4 text-white sm:p-5">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#e7c878]"><BarChart3 size={20} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#e7c878]">Báo cáo Thu–Chi</p><h2 className="mt-1 text-lg font-semibold">{drilldownReport.label}</h2><p className="mt-0.5 text-[10px] text-white/65">Dữ liệu đồng bộ theo thời gian và ca đang lọc.</p></div><button type="button" onClick={() => setDrilldown(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center"><span className="rounded-xl bg-white/[0.08] p-2 text-[9px] text-white/60">Tổng thu<strong className="mt-0.5 block text-[11px] text-white">{formatMoney(drilldownReport.collected)}</strong></span><span className="rounded-xl bg-white/[0.08] p-2 text-[9px] text-white/60">Tổng chi<strong className="mt-0.5 block text-[11px] text-[#ffd2ca]">{formatMoney(drilldownReport.expenses)}</strong></span><span className="rounded-xl bg-white/[0.08] p-2 text-[9px] text-white/60">Lãi tạm tính<strong className="mt-0.5 block text-[11px] text-[#e7c878]">{formatMoney(drilldownReport.profit)}</strong></span></div>
            </div>
            <div className="grid shrink-0 grid-cols-4 gap-1.5 border-b border-[#e7d6ca] bg-white p-3">
              {(["summary", "income", "expense", "tip"] as DrilldownMode[]).map((mode) => <button type="button" key={mode} onClick={() => setDrilldown({ ...drilldown, mode })} className={cn("rounded-full px-2 py-2 text-[9px] font-semibold sm:text-[10px]", drilldown.mode === mode ? "bg-[#c64b32] text-white" : "bg-[#f4eeea] text-[#68574f]")}>{mode === "summary" ? "Tổng quan" : mode === "income" ? "Doanh thu" : mode === "expense" ? "Chi phí" : "Tip KTV"}</button>)}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {drilldown.mode === "summary" ? <div className="space-y-3">
                <button type="button" onClick={() => setDrilldown({ ...drilldown, mode: "income" })} className="flex w-full items-center gap-3 rounded-2xl border border-[#e8d2c4] bg-[#fbf2e7] p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#76551d]"><ArrowDownLeft size={20} /></span><span className="min-w-0 flex-1"><small className="text-[10px] font-semibold uppercase tracking-wide text-[#76551d]">Dòng tiền vào</small><strong className="mt-0.5 block text-base">{formatMoney(drilldownReport.collected)}</strong><span className="mt-0.5 block text-[10px] text-[#a85f29]">Xem từng bill dịch vụ và khoản thu khác</span></span><ChevronRight size={17} className="text-[#76551d]" /></button>
                <button type="button" onClick={() => setDrilldown({ ...drilldown, mode: "expense" })} className="flex w-full items-center gap-3 rounded-2xl border border-[#efc6be] bg-[#f8ebe5] p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#c64b32]"><ArrowUpRight size={20} /></span><span className="min-w-0 flex-1"><small className="text-[10px] font-semibold uppercase tracking-wide text-[#c64b32]">Dòng tiền ra</small><strong className="mt-0.5 block text-base">{formatMoney(drilldownReport.expenses)}</strong><span className="mt-0.5 block text-[10px] text-[#7c635e]">Xem hạng mục vận hành và khoản chi phát sinh</span></span><ChevronRight size={17} className="text-[#c64b32]" /></button>
                <div className={cn("flex items-center gap-3 rounded-2xl border p-4", drilldownReport.profit >= 0 ? "border-[#e8d2c4] bg-[#fbf2e7]" : "border-[#efc6be] bg-[#f8ebe5]")}><span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white", drilldownReport.profit >= 0 ? "text-[#76551d]" : "text-[#c64b32]")}><TrendingUp size={20} /></span><span className="min-w-0 flex-1"><small className="text-[10px] font-semibold uppercase tracking-wide text-[#6f625b]">Lợi nhuận tạm tính</small><strong className={cn("mt-0.5 block text-base", drilldownReport.profit >= 0 ? "text-[#76551d]" : "text-[#c64b32]")}>{formatMoney(drilldownReport.profit)}</strong><span className="mt-0.5 block text-[10px] text-[#756962]">Doanh thu dịch vụ sau khi trừ toàn bộ chi phí</span></span></div>
                <button type="button" onClick={() => setDrilldown({ ...drilldown, mode: "tip" })} className="w-full rounded-2xl border border-[#e8d39e] bg-[#fff8e8] p-4 text-left"><div className="flex justify-between text-sm"><span>Tip KTV ngoài bill</span><strong className="text-[#76551d]">{formatMoney(drilldownReport.tips)}</strong></div><p className="mt-1 text-[10px] leading-4 text-[#806e65]">Theo dõi riêng, không cộng vào doanh thu dịch vụ và không trừ vào lãi cơ sở.</p></button>
              </div> : null}

              {drilldown.mode === "income" ? <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Doanh thu</h3><p className="text-[10px] text-[#826f66]">Bill dịch vụ và các khoản thu khác; không bao gồm Tip KTV.</p></div><strong className="text-sm text-[#76551d]">{formatMoney(drilldownReport.collected)}</strong></div>
                {drilldownBills.map((bill) => <button type="button" key={bill.code} onClick={() => { setSelectedBill(bill); setDrilldown(null); }} className="flex w-full items-start gap-3 rounded-xl border border-[#e7d6ca] bg-white p-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fbf2e7] text-[#76551d]"><ReceiptText size={16} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{bill.customer} · {bill.service}</strong><small className="mt-0.5 block text-[9px] text-[#826f66]">{displayBookingCode(bill.code)} · {format(bill.date, "HH:mm dd/MM")} · {bill.branchLabel}</small>{bill.tip ? <small className="mt-1 block text-[9px] font-semibold text-[#76551d]">Tip KTV ngoài bill: {formatMoney(bill.tip)}</small> : null}</span><strong className="shrink-0 text-[11px] text-[#76551d]">+{formatMoney(Math.min(bill.total, bill.collected))}</strong></button>)}
                {aggregateIncomeAmount > 0 ? <div className="flex items-start gap-3 rounded-xl border border-dashed border-[#d2ad5d] bg-[#fbf2e7] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#76551d]"><WalletCards size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">Doanh thu tổng hợp còn lại trong kỳ</strong><small className="mt-0.5 block text-[9px] leading-4 text-[#708078]">Đã đối soát từ sổ cái; các bill chi tiết hiện có được liệt kê phía trên.</small></span><strong className="shrink-0 text-[11px] text-[#76551d]">+{formatMoney(aggregateIncomeAmount)}</strong></div> : null}
              </div> : null}

              {drilldown.mode === "expense" ? <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Chi phí</h3><p className="text-[10px] text-[#826f66]">Vận hành định kỳ và chi phí phát sinh đã ghi nhận.</p></div><strong className="text-sm text-[#c64b32]">-{formatMoney(drilldownReport.expenses)}</strong></div>
                {drilldownExpenses.map((entry) => <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-[#e7b6a8] bg-[#fff9f7] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#c64b32]"><ReceiptText size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">{entry.description}</strong><small className="mt-0.5 block text-[9px] text-[#826f66]">{entry.category} · {entry.branchLabel}</small>{entry.evidenceUrl ? <a href={entry.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-[#76551d] ring-1 ring-[#e8d39e]"><Eye size={11} /> Xem ảnh bill</a> : null}</span><strong className="shrink-0 text-[11px] text-[#c64b32]">-{formatMoney(entry.amount)}</strong></div>)}
                {aggregateExpenseAmount > 0 ? <div className="flex items-start gap-3 rounded-xl border border-dashed border-[#e7b6a8] bg-[#fff9f7] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#c64b32]"><Landmark size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">Chi phí tổng hợp trong sổ cái</strong><small className="mt-0.5 block text-[9px] text-[#826f66]">Phần hạch toán lịch sử chưa gắn chứng từ chi tiết.</small></span><strong className="shrink-0 text-[11px] text-[#c64b32]">-{formatMoney(aggregateExpenseAmount)}</strong></div> : null}
              </div> : null}

              {drilldown.mode === "tip" ? <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Tip KTV</h3><p className="text-[10px] leading-4 text-[#826f66]">Theo dõi riêng ngoài bill dịch vụ, không tính vào doanh thu hoặc lãi cơ sở.</p></div><strong className="shrink-0 text-sm text-[#76551d]">{formatMoney(drilldownReport.tips)}</strong></div>
                {drilldownBills.filter((bill) => bill.tip > 0).map((bill) => <button type="button" key={bill.code} onClick={() => { setSelectedBill(bill); setDrilldown(null); }} className="flex w-full items-start gap-3 rounded-xl border border-[#e8d39e] bg-[#fffaf0] p-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#76551d]"><CircleDollarSign size={16} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{bill.customer} · {bill.therapist}</strong><small className="mt-0.5 block text-[9px] text-[#826f66]">{displayBookingCode(bill.code)} · {format(bill.date, "HH:mm dd/MM")} · {bill.branchLabel}</small></span><strong className="shrink-0 text-[11px] text-[#76551d]">+{formatMoney(bill.tip)}</strong></button>)}
                {aggregateTipAmount > 0 ? <div className="flex items-start gap-3 rounded-xl border border-dashed border-[#e8d39e] bg-[#fffaf0] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#76551d]"><CircleDollarSign size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px]">Tip KTV tổng hợp còn lại trong kỳ</strong><small className="mt-0.5 block text-[9px] leading-4 text-[#826f66]">Đã đối soát theo đúng cơ sở và thời gian đang lọc.</small></span><strong className="shrink-0 text-[11px] text-[#76551d]">+{formatMoney(aggregateTipAmount)}</strong></div> : null}
                {drilldownReport.tips === 0 ? <p className="rounded-xl border border-dashed border-[#e8d39e] bg-[#fffaf0] p-5 text-center text-[10px] text-[#826f66]">Chưa có khoản Tip KTV trong phạm vi đang lọc.</p> : null}
              </div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {selectedBill ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" onClick={() => setSelectedBill(null)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Đóng" />
          <section className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="bg-gradient-to-br from-[#231514] via-[#4a2616] to-[#8b2b28] p-5 text-white"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#e7c878]"><ReceiptText size={21} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e7c878]">Bill quản trị · {selectedBill.branchLabel}</p><h2 className="mt-1 text-lg font-semibold">{selectedBill.customer}</h2><p className="mt-0.5 text-xs text-white/70">{displayBookingCode(selectedBill.code)}</p></div><button type="button" onClick={() => setSelectedBill(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button></div></div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl bg-[#fdf8f3] p-3"><span className="text-[#826f66]">Khách hàng</span><strong className="mt-1 block">{selectedBill.customer}</strong><span className="mt-0.5 block text-[#68574f]">{selectedBill.phone}</span></div><div className="rounded-xl bg-[#fdf8f3] p-3"><span className="text-[#826f66]">Thời gian</span><strong className="mt-1 block">{format(selectedBill.date, "HH:mm dd/MM/yyyy")}</strong><span className="mt-0.5 block text-[#68574f]">{selectedBill.branchLabel}</span></div></div>
              <div className="rounded-xl border border-[#e7d6ca] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c64b32]">Dịch vụ & KTV</p><div className="mt-2 flex items-start justify-between gap-3 text-sm"><span>{selectedBill.service}<small className="mt-1 block text-[10px] text-[#826f66]">KTV: {selectedBill.therapist}</small></span><strong className="shrink-0">{formatMoney(selectedBill.total)}</strong></div></div>
              <div className="space-y-2 rounded-2xl bg-[#fdf8f3] p-4 text-sm"><div className="flex justify-between"><span>Tổng bill dịch vụ</span><strong>{formatMoney(selectedBill.total)}</strong></div><div className="flex justify-between text-[#76551d]"><span>Đã cọc cho nền tảng</span><strong>{formatMoney(selectedBill.deposit)}</strong></div><div className="flex justify-between"><span>Khách đã chuyển</span><strong>{formatMoney(selectedBill.collected)}</strong></div><div className="flex justify-between text-[#c64b32]"><span>Còn phải thu dịch vụ</span><strong>{formatMoney(Math.max(0, selectedBill.total - Math.min(selectedBill.total, selectedBill.collected)))}</strong></div><div className="border-t border-dashed border-[#d2ad5d] pt-2"><div className="flex justify-between"><span>Doanh thu đối tác trước chi phí vận hành</span><strong>{formatMoney(Math.max(0, Math.min(selectedBill.total, selectedBill.collected) - selectedBill.deposit))}</strong></div><div className="mt-2 flex justify-between text-[#c64b32]"><span>Chi phí nền tảng Xgroup</span><strong>{formatMoney(selectedBill.deposit)}</strong></div><div className="mt-2 flex justify-between text-[#76551d]"><span>Tip KTV ngoài bill</span><strong>{formatMoney(selectedBill.tip)}</strong></div></div></div>
              <div className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold", selectedBill.total <= selectedBill.collected ? "bg-[#fbf2e7] text-[#76551d]" : "bg-[#fff7df] text-[#76551d]")}><span>Trạng thái đối soát</span><span>{selectedBill.total <= selectedBill.collected ? "Đã thanh toán xong" : `Đã cọc · Còn ${formatMoney(selectedBill.total - selectedBill.collected)}`}</span></div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
