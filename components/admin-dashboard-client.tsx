"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bed,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  ShieldCheck,
  Star,
  TrendingUp,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { usePublicCatalog } from "@/lib/catalog-store";
import { branches as demoBranches } from "@/lib/demo-data";
import { CompactSelect } from "@/components/compact-select";
import { bookingStatusLabel } from "@/lib/labels";
import { cn, formatMoney } from "@/lib/utils";
import { useAdminSession } from "@/components/admin-session-provider";
import { ADMIN_SECTION_GROUPS, ADMIN_SECTION_META } from "@/lib/admin-section-config";

type Period = "day" | "week" | "month" | "year" | "custom" | "all";
type DayPart = "all" | "morning" | "afternoon" | "evening";
type DashboardFinance = {
  serviceRevenue: number;
  deposits: number;
  expenses: number;
  tips: number;
  profit: number;
  branchBreakdown: { branchId: string; revenue: number; expenses: number; tips: number; profit: number }[];
};
type DashboardOperations = {
  bookingCount: number;
  statusCounts: Record<string, number>;
  expectedRevenue: number;
  customerCount: number;
  customerSegments: { new: number; returning: number; vip: number };
  seatCapacity: number;
  activeTherapists: number;
  activeRooms: number;
  maintenanceRooms: number;
  roomUtilization: number;
  therapistUtilization: number;
  averageRating: number;
  servedCount: number;
  bookings: Array<{ id: string; bookingCode: string; customerName: string; serviceLabel: string; therapistName: string; branchLabel: string; startTime: string; status: string; totalAmount: number }>;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "year", label: "Năm nay" },
  { value: "custom", label: "Từ ngày" },
  { value: "all", label: "Bất kỳ" },
];

const DAY_PARTS: { value: DayPart; label: string }[] = [
  { value: "all", label: "Cả ngày" },
  { value: "morning", label: "Ca sáng" },
  { value: "afternoon", label: "Ca chiều" },
  { value: "evening", label: "Ca tối" },
];

function rangeFor(period: Period, anchor: Date, customFrom: string, customTo: string) {
  if (period === "all") return null;
  if (period === "week") return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period === "month") return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  if (period === "year") return { start: startOfYear(anchor), end: endOfYear(anchor) };
  if (period === "custom") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : startOfDay(anchor);
    const to = customTo ? new Date(`${customTo}T23:59:59`) : endOfDay(anchor);
    return from <= to ? { start: from, end: to } : { start: startOfDay(to), end: endOfDay(from) };
  }
  return { start: startOfDay(anchor), end: endOfDay(anchor) };
}

export function AdminDashboardClient() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const today = useMemo(() => new Date(), []);
  const [selectedKpi, setSelectedKpi] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [dayPart, setDayPart] = useState<DayPart>("all");
  const [branchId, setBranchId] = useState(session?.branchId ?? "all");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(today, "yyyy-MM-dd"));
  const [serverFinance, setServerFinance] = useState<DashboardFinance | null>(null);
  const [serverOperations, setServerOperations] = useState<DashboardOperations | null>(null);

  useEffect(() => {
    if (!session) return;
    const range = rangeFor(period, today, customFrom, customTo) ?? { start: new Date("2020-01-01"), end: new Date("2035-12-31") };
    const scopedBranch = session.role === "OWNER" ? branchId : session.branchId ?? "all";
    const query = new URLSearchParams({ from: format(range.start, "yyyy-MM-dd"), to: format(range.end, "yyyy-MM-dd"), branchId: scopedBranch });
    const operationsQuery = new URLSearchParams(query);
    operationsQuery.set("dayPart", dayPart);
    let active = true;
    async function load() {
      try {
        const [financeResponse, operationsResponse] = await Promise.all([
          fetch(`/api/finance/summary?${query}`, { cache: "no-store" }),
          fetch(`/api/operations/summary?${operationsQuery}`, { cache: "no-store" }),
        ]);
        if (!financeResponse.ok || !operationsResponse.ok) throw new Error("dashboard unavailable");
        const [financeData, operationsData] = await Promise.all([financeResponse.json(), operationsResponse.json()]);
        if (active) {
          setServerFinance(financeData);
          setServerOperations(operationsData);
        }
      } catch {
        // Giữ snapshot DB gần nhất khi thiết bị tạm mất kết nối.
      }
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [branchId, customFrom, customTo, dayPart, period, session, today]);
  if (!session) return null;

  const isOwner = session.role === "OWNER";
  const activeBranchId = isOwner ? branchId : session.branchId ?? branches[0].id;
  const matchesBranch = (candidate?: string) => activeBranchId === "all" || candidate === activeBranchId;
  const periodLabel = PERIODS.find((item) => item.value === period)?.label ?? "Bất kỳ";
  const dayPartLabel = DAY_PARTS.find((item) => item.value === dayPart)?.label ?? "Cả ngày";
  const branchLabel = activeBranchId === "all" ? "Toàn hệ thống" : branches.find((item) => item.id === activeBranchId)?.label ?? session.branchLabel;

  const bookingTotal = serverOperations?.bookingCount ?? 0;
  const pendingAdminCount = serverOperations?.statusCounts.PENDING ?? 0;
  const confirmedCount = serverOperations?.statusCounts.CONFIRMED ?? 0;
  const rejectedCount = (serverOperations?.statusCounts.CANCELLED ?? 0) + (serverOperations?.statusCounts.NO_SHOW ?? 0);
  const completedCount = serverOperations?.statusCounts.COMPLETED ?? 0;
  const scopedSeatCapacity = serverOperations?.seatCapacity ?? 0;
  const roomUtilization = serverOperations?.roomUtilization ?? 0;
  const therapistUtilization = serverOperations?.therapistUtilization ?? 0;
  const averageRating = serverOperations?.averageRating ?? 0;
  const expectedRevenue = serverOperations?.expectedRevenue ?? 0;
  const collectedAmount = serverFinance?.serviceRevenue ?? 0;
  const expenseAmount = serverFinance?.expenses ?? 0;
  const provisionalProfit = serverFinance?.profit ?? collectedAmount - expenseAmount;

  const branchFinanceRows = branches.filter((item) => matchesBranch(item.id)).map((item) => {
    const serverBranch = serverFinance?.branchBreakdown.find((row) => row.branchId === item.id);
    return [item.label, formatMoney(serverBranch?.profit ?? 0)] as [string, string];
  });

  const kpis = [
    { label: "Booking trong phạm vi", value: bookingTotal, icon: CalendarCheck, detail: `${periodLabel} · ${branchLabel}`, rows: [["Chờ xác nhận", pendingAdminCount], ["Đã xác nhận", confirmedCount], ["Cần đổi lịch / vắng hẹn", rejectedCount], ["Đã hoàn thành", completedCount]], href: "/admin/bookings" },
    { label: "Khách đang quản lý", value: serverOperations?.customerCount ?? 0, icon: UsersRound, detail: `${periodLabel} · ${branchLabel}`, rows: [["Khách mới", serverOperations?.customerSegments.new ?? 0], ["Khách quay lại", serverOperations?.customerSegments.returning ?? 0], ["Khách VIP / dài hạn", serverOperations?.customerSegments.vip ?? 0]], href: "/admin/customers" },
    { label: "Công suất giường", value: `${roomUtilization}%`, icon: Bed, detail: `${scopedSeatCapacity} giường · ${serverOperations?.activeTherapists ?? 0} KTV`, rows: [["Tổng giường", scopedSeatCapacity], ["KTV đang hoạt động", serverOperations?.activeTherapists ?? 0], ["Booking / sức chứa", `${bookingTotal}/${scopedSeatCapacity}`]], href: "/admin/capacity" },
    { label: "Hiệu suất KTV", value: `${therapistUtilization}%`, icon: Activity, detail: `${averageRating.toFixed(1)} ★ trung bình`, rows: [["KTV đang hoạt động", serverOperations?.activeTherapists ?? 0], ["Đánh giá trung bình", `${averageRating.toFixed(1)} sao`], ["Tổng lượt đã phục vụ", serverOperations?.servedCount ?? 0]], href: "/admin/therapists" },
    { label: "Tổng thu", value: formatMoney(collectedAmount), icon: CircleDollarSign, detail: "Doanh thu dịch vụ · không gồm Tip KTV", rows: [["Doanh thu dịch vụ", formatMoney(collectedAmount)], ["Tiền cọc đã nhận", formatMoney(serverFinance?.deposits ?? 0)], ["Tip KTV ngoài bill", formatMoney(serverFinance?.tips ?? 0)], ...branchFinanceRows], href: "/admin/finance" },
    { label: "Tổng chi", value: formatMoney(expenseAmount), icon: ReceiptText, detail: "Vận hành + khoản chi phát sinh", rows: [["Chi phí đã hạch toán", formatMoney(expenseAmount)], ["Nguồn dữ liệu", "Sổ cái hệ thống"], ["Tổng chi trong phạm vi", formatMoney(expenseAmount)]], href: "/admin/finance" },
    { label: "Doanh thu dự kiến", value: formatMoney(expectedRevenue), icon: Wallet, detail: `${periodLabel} · ${branchLabel}`, rows: [["Tổng giá trị lịch", formatMoney(expectedRevenue)], ["Đã ghi nhận thu", formatMoney(collectedAmount)], ["Còn dự kiến thu", formatMoney(Math.max(0, expectedRevenue - collectedAmount))]], href: "/admin/finance" },
    { label: "Lãi tạm tính", value: formatMoney(provisionalProfit), icon: TrendingUp, detail: `Tổng thu − ${formatMoney(expenseAmount)} tổng chi`, rows: [["Tổng thu", formatMoney(collectedAmount)], ["Tổng chi", formatMoney(expenseAmount)], ["Biên lãi tạm tính", collectedAmount ? `${Math.round((provisionalProfit / collectedAmount) * 100)}%` : "0%"], ...branchFinanceRows], href: "/admin/finance" },
  ];

  const scheduleRows = (serverOperations?.bookings ?? []).map((booking) => ({
    key: booking.id,
    time: new Date(booking.startTime),
    customer: booking.customerName,
    service: booking.serviceLabel,
    therapist: booking.therapistName,
    branch: booking.branchLabel,
    status: bookingStatusLabel(booking.status),
    amount: booking.totalAmount,
  }));

  const quickSections = ADMIN_SECTION_GROUPS.flatMap((group) => group.sections).filter((slug) => session.permissions.includes(slug)).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#231514] via-[#3d1f12] to-[#5c1014] p-4 text-white shadow-lg sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#c59a3d]/15 blur-3xl" />
        <div className="relative">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#e7c878]">{isOwner ? <ShieldCheck size={14} /> : <Building2 size={14} />} {session.title}</p>
            <h1 className="mt-1.5 text-xl font-semibold">Vận hành theo phạm vi</h1>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-white/75">{isOwner ? "Dưới đây là báo cáo tổng quát toàn hệ thống Tâm An Center" : `Dưới đây là báo cáo vận hành của ${session.branchLabel}`}</p>
          </div>
          <div className="mt-4 border-t border-white/15 pt-3">
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
              {PERIODS.map((item) => <button key={item.value} type="button" onClick={() => setPeriod(item.value)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition", period === item.value ? "bg-[#e7c878] text-[#3d1f12]" : "bg-white/10 text-white/75")}>{item.label}</button>)}
            </div>
            {period === "custom" ? <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[9px] font-semibold text-white/60">Từ ngày<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-[11px] text-white [color-scheme:dark]" /></label><label className="text-[9px] font-semibold text-white/60">Đến ngày<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-[11px] text-white [color-scheme:dark]" /></label></div> : null}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <CompactSelect value={activeBranchId} disabled={!isOwner} onValueChange={setBranchId} dark dialogTitle="Lọc theo cơ sở" triggerClassName="min-h-0 rounded-lg bg-[#3b241f] py-2 text-[11px]" options={[{ value: "all", label: "Tất cả cơ sở" }, ...branches.map((item) => ({ value: item.id, label: item.label }))]} />
              <CompactSelect value={dayPart} onValueChange={(next) => setDayPart(next as DayPart)} dark dialogTitle="Lọc theo ca" triggerClassName="min-h-0 rounded-lg bg-[#3b241f] py-2 text-[11px]" options={DAY_PARTS} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {kpis.map((item, index) => { const Icon = item.icon; return <button type="button" onClick={() => setSelectedKpi(index)} key={item.label} className="flex min-h-[78px] min-w-0 items-center gap-2.5 rounded-xl border border-[#d2ad5d]/55 bg-white p-2.5 text-left shadow-sm transition active:scale-[0.98]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8ebe5] text-[#c64b32]"><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium text-[#826f66]">{item.label}</span><span className="mt-0.5 flex items-center gap-1 text-sm font-bold tracking-tight sm:text-base">{item.value}{item.label === "Hiệu suất KTV" ? <Star size={11} className="fill-[#9f7428] text-[#9f7428]" /> : null}</span><span className="mt-0.5 line-clamp-1 text-[9px] leading-3 text-[#826f66]">{item.detail}</span></span></button>; })}
      </section>

      <section className="mt-3 rounded-xl border border-[#e7d6ca] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Lịch trong phạm vi ({periodLabel.toLocaleLowerCase("vi")}, {dayPartLabel.toLocaleLowerCase("vi")})</h2><p className="mt-0.5 text-[10px] text-[#826f66]">{branchLabel} · thay đổi đồng bộ theo bộ lọc phía trên.</p></div><Clock3 size={20} className="shrink-0 text-[#c64b32]" /></div>
        <div className="mt-3 space-y-2 md:hidden">{scheduleRows.slice(0, 4).map((row) => <div key={row.key} className="rounded-xl bg-[#fdf8f3] p-2.5"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{row.customer}</p><span className="rounded-full bg-[#f8ebe5] px-2 py-1 text-[9px] font-semibold text-[#c64b32]">{row.status}</span></div><p className="mt-1 text-xs text-[#68574f]">{row.service} · {row.therapist}</p><div className="mt-2 flex justify-between text-[10px] text-[#826f66]"><span>{format(row.time, "HH:mm dd/MM")} · {row.branch}</span><strong className="text-[#281b18]">{formatMoney(row.amount)}</strong></div></div>)}{scheduleRows.length === 0 ? <p className="rounded-xl bg-[#fdf8f3] p-5 text-center text-xs text-[#826f66]">Không có lịch phù hợp bộ lọc.</p> : null}</div>
        <div className="mt-3 hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-[#826f66]"><tr className="border-b border-[#e7d6ca]"><th className="py-2.5">Thời gian</th><th>Khách</th><th>Dịch vụ</th><th>KTV / Cơ sở</th><th>Trạng thái</th><th className="text-right">Tổng</th></tr></thead><tbody>{scheduleRows.map((row) => <tr key={row.key} className="border-b border-[#f2e7df]"><td className="py-3 font-semibold">{format(row.time, "HH:mm dd/MM")}</td><td>{row.customer}</td><td>{row.service}</td><td>{row.therapist}<span className="block text-[10px] text-[#826f66]">{row.branch}</span></td><td><span className="rounded-full bg-[#f8ebe5] px-2 py-1 text-[10px] font-semibold text-[#c64b32]">{row.status}</span></td><td className="text-right font-semibold">{formatMoney(row.amount)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-3 rounded-xl border border-[#e7d6ca] bg-white p-3 shadow-sm sm:p-4">
        <h2 className="text-sm font-semibold">Truy cập nhanh</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{quickSections.map((slug) => { const meta = ADMIN_SECTION_META[slug]; const Icon = meta.icon; return <Link key={slug} href={`/admin/${slug}`} className="group flex min-h-[78px] min-w-0 items-center gap-2.5 rounded-xl border border-[#d2ad5d]/55 bg-[#fffdfb] p-2.5 hover:border-[#c64b32]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fbf2e7] text-[#7a3e1d]"><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{meta.label}</span><span className="mt-0.5 block line-clamp-2 text-[9px] leading-3 text-[#826f66]">{meta.shortDescription}</span></span><ArrowRight size={13} className="shrink-0 text-[#9f7428] transition group-hover:translate-x-0.5" /></Link>; })}</div>
      </section>

      <section className="mt-3 rounded-xl border border-[#c59a3d]/45 bg-[#fbf2e7] p-3"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#7a541c]"><AlertTriangle size={14} /> Cần chú ý</p><div className="mt-2 grid gap-1 text-[11px] leading-4 text-[#715943] sm:grid-cols-3"><p>• {serverOperations?.maintenanceRooms ?? 0} phòng/ghế đang bảo trì.</p><p>• {confirmedCount} lịch đã cọc đang chờ check-in.</p><p>• {pendingAdminCount} booking mới cần phản hồi.</p></div></section>

      {selectedKpi !== null ? (() => { const item = kpis[selectedKpi]; const Icon = item.icon; return <div className="fixed inset-0 z-50 flex items-end bg-black/45 pb-[env(safe-area-inset-bottom)] sm:items-center sm:justify-center sm:p-5"><section className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:max-w-md sm:rounded-2xl"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5c3a1e] text-[#e7c878]"><Icon size={18} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#c64b32]">Dữ liệu cấu thành</p><h2 className="mt-0.5 text-lg font-semibold">{item.label}</h2><p className="mt-0.5 text-[11px] text-[#826f66]">{periodLabel} · {dayPartLabel} · {branchLabel}</p></div><button type="button" onClick={() => setSelectedKpi(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button></div><div className="mt-4 space-y-2">{item.rows.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl border border-[#e7d6ca] px-3 py-3"><span className="flex items-center gap-1.5 text-xs text-[#68574f]"><CheckCircle2 size={13} className="text-[#9f7428]" /> {label}</span><strong className="text-sm">{value}</strong></div>)}</div><Link href={item.href} onClick={() => setSelectedKpi(null)} className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-[#c64b32] py-2.5 text-xs font-semibold text-white">Xem dữ liệu chi tiết <ArrowRight size={13} /></Link></section></div>; })() : null}
    </div>
  );
}
