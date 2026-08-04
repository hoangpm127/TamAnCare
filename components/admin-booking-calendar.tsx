"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, isWithinInterval, startOfMonth, startOfWeek } from "date-fns";
import { Bot, Building2, CalendarClock, ChevronLeft, ChevronRight, Loader2, Plus, ShieldCheck, UserCheck } from "lucide-react";
import type { AdminAccount } from "@/lib/admin-auth";
import type { AdminBookingRequest, AdminBusinessRequest } from "@/lib/admin-booking-store";
import { usePublicCatalog } from "@/lib/catalog-store";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const KIND = {
  personal: { label: "Cá nhân", dot: "bg-[#c64b32]", text: "text-[#c64b32]", pale: "bg-[#fae9e4]" },
  friend: { label: "Rủ bạn", dot: "bg-[#d89a22]", text: "text-[#8a5a12]", pale: "bg-[#fff6df]" },
  boss: { label: "Mời sếp", dot: "bg-[#7654b8]", text: "text-[#5e3d9b]", pale: "bg-[#f2edff]" },
  business: { label: "Business", dot: "bg-[#a85f29]", text: "text-[#76551d]", pale: "bg-[#fbf2e7]" },
} as const;

function monthTitle(value: Date) {
  const title = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(value);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

type AutomationView = {
  mode: "AUTO" | "MANUAL";
  source: "BRANCH" | "GLOBAL" | "DEFAULT";
  scopeLabel: string;
  canManage: boolean;
  automaticallyConfirmed?: number;
};

function BookingAutomationControl({ branchId }: { branchId: string }) {
  const [view, setView] = useState<AutomationView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = branchId === "all" ? "" : `?branchId=${encodeURIComponent(branchId)}`;
    void fetch(`/api/admin-booking-automation${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải chế độ xác nhận.");
        if (active) setView(data as AutomationView);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Không thể tải cấu hình."));
    return () => { active = false; };
  }, [branchId]);

  async function changeMode(mode: AutomationView["mode"]) {
    if (!view?.canManage || view.mode === mode || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin-booking-automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branchId === "all" ? null : branchId, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể đổi chế độ xác nhận.");
      setView(data as AutomationView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2.5 rounded-xl bg-white/10 p-1.5 ring-1 ring-white/10">
      <div className="flex items-center justify-center gap-1.5 text-center text-[9px] font-semibold text-white/75">
        {saving || !view ? <Loader2 className="animate-spin" size={11} /> : view.mode === "AUTO" ? <Bot size={11} className="text-[#e7c878]" /> : <UserCheck size={11} className="text-[#e7c878]" />}
        <span>{view ? `${view.scopeLabel} · ${view.mode === "AUTO" ? "AI xác nhận sau đối soát cọc" : "Admin/Quản lý xác nhận thủ công"}` : "Đang tải chế độ xác nhận…"}</span>
      </div>
      {view ? (
        <div className="mx-auto mt-1.5 grid max-w-xs grid-cols-2 gap-1 rounded-lg bg-[#211311]/70 p-1">
          <button type="button" disabled={!view.canManage || saving} onClick={() => void changeMode("AUTO")} className={cn("inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-bold transition disabled:cursor-not-allowed", view.mode === "AUTO" ? "bg-[#e7c878] text-[#3d1f12]" : "text-white/65")}><Bot size={11} /> AI tự động</button>
          <button type="button" disabled={!view.canManage || saving} onClick={() => void changeMode("MANUAL")} className={cn("inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-bold transition disabled:cursor-not-allowed", view.mode === "MANUAL" ? "bg-white text-[#63291d]" : "text-white/65")}><UserCheck size={11} /> Xác nhận thủ công</button>
        </div>
      ) : null}
      {view?.automaticallyConfirmed ? <p className="mt-1 text-center text-[8px] font-semibold text-[#f1e5dd]">Đã tự xác nhận {view.automaticallyConfirmed} lịch đủ điều kiện đang chờ.</p> : null}
      {error ? <p className="mt-1 text-center text-[8px] font-semibold text-[#ffd7d1]">{error}</p> : null}
    </div>
  );
}

export function AdminBookingCalendar({
  session,
  regular,
  business,
  branchId,
  selectedDay,
  onBranchChange,
  onDaySelect,
  onCreate,
}: {
  session: AdminAccount;
  regular: AdminBookingRequest[];
  business: AdminBusinessRequest[];
  branchId: string;
  selectedDay: Date;
  onBranchChange: (value: string) => void;
  onDaySelect: (day: Date) => void;
  onCreate: () => void;
}) {
  const catalog = usePublicCatalog();
  const branches = catalog.branches;
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const allowedBranch = session.role === "OWNER" ? branchId : session.branchId ?? branches[0].id;
  const filteredRegular = regular.filter((item) => allowedBranch === "all" || item.branchId === allowedBranch);
  const filteredBusiness = business.filter((item) => allowedBranch === "all" || item.branchId === allowedBranch);
  const monthRange = { start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) };
  const calendarRange = { start: startOfWeek(monthRange.start, { weekStartsOn: 1 }), end: endOfWeek(monthRange.end, { weekStartsOn: 1 }) };
  const days = eachDayOfInterval(calendarRange);
  const monthRegular = filteredRegular.filter((item) => isWithinInterval(new Date(item.timeIso), monthRange));
  const monthBusiness = filteredBusiness.filter((item) => isWithinInterval(new Date(item.startsAt), monthRange));
  const pending = monthRegular.filter((item) => item.status === "NEW").length + monthBusiness.filter((item) => ["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"].includes(item.status)).length;
  const confirmed = monthRegular.filter((item) => ["CONFIRMED", "CHECKED_IN", "IN_SERVICE"].includes(item.rawStatus)).length + monthBusiness.filter((item) => ["READY", "IN_SERVICE"].includes(item.status)).length;

  function changeMonth(next: Date) {
    const month = startOfMonth(next);
    setVisibleMonth(month);
    onDaySelect(isSameMonth(today, month) ? today : month);
  }

  function selectDay(day: Date) {
    if (!isSameMonth(day, visibleMonth)) setVisibleMonth(startOfMonth(day));
    onDaySelect(day);
  }

  return <section className="relative overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-white shadow-[0_12px_32px_rgba(74,44,28,0.08)]">
    <div className="bg-gradient-to-r from-[#291714] via-[#63291d] to-[#c64b32] px-3.5 py-3 text-white sm:px-5">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><CalendarClock size={17} /></span><div className="min-w-0 text-center"><p className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#e7c878]">{session.role === "OWNER" ? <ShieldCheck size={11} /> : <Building2 size={11} />} {session.branchLabel}</p><h1 className="truncate text-base font-semibold sm:text-lg">Quản lý Booking</h1></div><button type="button" onClick={onCreate} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c59a3d] text-[#3d1f12]" aria-label="Tạo booking"><Plus size={16} /></button></div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-semibold"><span className="rounded-full bg-white/12 px-2.5 py-1">{monthRegular.length + monthBusiness.length} Booking</span><span className="rounded-full bg-[#fff0c9] px-2.5 py-1 text-[#76551d]">{pending} chờ xử lý</span><span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 text-[#76551d]">{confirmed} đã xếp lịch</span></div>
      <BookingAutomationControl key={allowedBranch} branchId={allowedBranch} />
    </div>

    <div className="border-b border-[#e7d6ca] bg-[#fffdfb] p-2.5 sm:px-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"><button type="button" aria-label="Tháng trước" onClick={() => changeMonth(addMonths(visibleMonth, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7d6ca] bg-white text-[#8c332a]"><ChevronLeft size={17} /></button><label className="relative block min-w-0"><span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold capitalize text-[#291714]">{monthTitle(visibleMonth)}</span><input aria-label="Chọn tháng Booking" type="month" value={format(visibleMonth, "yyyy-MM")} onChange={(event) => event.target.value && changeMonth(new Date(`${event.target.value}-01T12:00:00`))} className="h-9 w-full cursor-pointer rounded-xl border border-[#e7d6ca] bg-white text-center text-transparent [color-scheme:light]" /></label><button type="button" aria-label="Tháng sau" onClick={() => changeMonth(addMonths(visibleMonth, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7d6ca] bg-white text-[#8c332a]"><ChevronRight size={17} /></button></div>
      <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto rounded-xl bg-[#f7f1ed] p-1">{session.role === "OWNER" ? <button type="button" onClick={() => onBranchChange("all")} className={cn("shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold", allowedBranch === "all" ? "bg-[#291714] text-white shadow-sm" : "text-[#68574f]")}>Tất cả</button> : null}{branches.filter((item) => session.role === "OWNER" || item.id === session.branchId).map((branch) => { const count = regular.filter((item) => item.branchId === branch.id && isWithinInterval(new Date(item.timeIso), monthRange)).length + business.filter((item) => item.branchId === branch.id && isWithinInterval(new Date(item.startsAt), monthRange)).length; const active = allowedBranch === branch.id; return <button key={branch.id} type="button" onClick={() => session.role === "OWNER" && onBranchChange(branch.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold", active ? "bg-[#c64b32] text-white" : "text-[#68574f]")}><i className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-[#e7c878]" : "bg-[#9f7428]")} />{branch.label}<span className={cn("rounded-full px-1.5 text-[8px]", active ? "bg-white/15" : "bg-white")}>{count}</span></button>; })}</div>
    </div>

    <div className="relative bg-gradient-to-b from-[#fffaf4] to-white px-2 pb-3 pt-5 sm:px-4 sm:pb-4"><div aria-hidden className="absolute left-4 right-4 top-0 flex -translate-y-1/2 justify-around">{Array.from({ length: 7 }, (_, index) => <span key={index} className="h-5 w-2 rounded-full border border-[#7b5129] bg-gradient-to-b from-[#f6d989] via-[#a8752e] to-[#e7c878] shadow-sm" />)}</div><div className="grid grid-cols-7 border-b border-[#e7d6ca] pb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a6a58]">{WEEKDAYS.map((day) => <span key={day} className={day === "CN" ? "text-[#c64b32]" : ""}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">{days.map((day) => {
        const dayRegular = filteredRegular.filter((item) => isSameDay(new Date(item.timeIso), day));
        const dayBusiness = filteredBusiness.filter((item) => isSameDay(new Date(item.startsAt), day));
        const counts = { personal: dayRegular.filter((item) => !item.relationship || item.relationship === "SELF").length, friend: dayRegular.filter((item) => item.relationship === "FRIEND").length, boss: dayRegular.filter((item) => item.relationship === "BOSS").length, business: dayBusiness.length };
        const total = counts.personal + counts.friend + counts.boss + counts.business;
        const selected = isSameDay(day, selectedDay);
        const currentMonth = isSameMonth(day, visibleMonth);
        const detailLabel = Object.entries(counts).filter(([, count]) => count > 0).map(([kind, count]) => `${KIND[kind as keyof typeof KIND].label} ${count}`).join(", ");
        return <button key={day.toISOString()} type="button" aria-label={`Ngày ${format(day, "dd/MM")}${total ? `, ${detailLabel}` : ", chưa có Booking"}`} aria-pressed={selected} onClick={() => selectDay(day)} className={cn("relative min-h-[70px] rounded-xl border px-1 py-1.5 text-left transition sm:min-h-[92px] sm:px-2", selected ? "border-[#c64b32] bg-[#fae9e4] shadow-[0_5px_15px_rgba(159,29,32,0.13)] ring-1 ring-[#c64b32]/20" : "border-[#eee4dd] bg-white hover:border-[#d2ad5d]", !currentMonth && "opacity-40")}><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", isToday(day) ? "bg-[#c64b32] text-white" : selected ? "text-[#c64b32]" : "text-[#3c2d27]")}>{format(day, "d")}</span>{total ? <div className="mt-1 grid grid-cols-2 gap-0.5 sm:mt-2">{(Object.keys(KIND) as Array<keyof typeof KIND>).map((kind) => counts[kind] ? <span key={kind} title={KIND[kind].label} className={cn("flex items-center justify-center gap-1 rounded-md px-0.5 py-1 text-[8px] font-bold", KIND[kind].pale, KIND[kind].text)}><i className={cn("h-1.5 w-1.5 rounded-full", KIND[kind].dot)} />{counts[kind]}</span> : null)}</div> : <span className="mt-2 block text-center text-[8px] text-[#c1b5ae]">—</span>}</button>;
      })}</div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-[8px] text-[#756861]">{(Object.keys(KIND) as Array<keyof typeof KIND>).map((kind) => <span key={kind}><i className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", KIND[kind].dot)} />{KIND[kind].label}</span>)}</div>
    </div>
  </section>;
}
