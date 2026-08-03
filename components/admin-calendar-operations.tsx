"use client";

import { useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { useAdminSession } from "@/components/admin-session-provider";
import { useAdminBookingRequests } from "@/lib/admin-booking-store";
import { usePublicCatalog } from "@/lib/catalog-store";
import { branches as demoBranches } from "@/lib/demo-data";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";

type DayPart = "all" | "morning" | "afternoon" | "evening";
type CalendarEvent = {
  code: string;
  customer: string;
  phone: string;
  service: string;
  therapist: string;
  room: string;
  branchId: string;
  start: Date;
  end: Date;
  amount: number;
  deposit: number;
  rawStatus: string;
};

const DAY_PARTS: { value: DayPart; label: string }[] = [
  { value: "all", label: "Mọi khung giờ" },
  { value: "morning", label: "Ca sáng" },
  { value: "afternoon", label: "Ca chiều" },
  { value: "evening", label: "Ca tối" },
];

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function inDayPart(date: Date, dayPart: DayPart) {
  const hour = date.getHours();
  return dayPart === "all"
    || (dayPart === "morning" && hour < 12)
    || (dayPart === "afternoon" && hour >= 12 && hour < 18)
    || (dayPart === "evening" && hour >= 18);
}

function monthTitle(value: Date) {
  const title = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(value);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function statusView(rawStatus: string) {
  if (rawStatus === "PENDING") return { label: "Chờ xác nhận", badge: "bg-[#fff0c9] text-[#805914]", dot: "bg-[#d99a22]" };
  if (["CHECKED_IN", "IN_SERVICE"].includes(rawStatus)) return { label: "Đang phục vụ", badge: "bg-[#ffe0de] text-[#9f1d20]", dot: "bg-[#c33838]" };
  if (rawStatus === "COMPLETED") return { label: "Hoàn thành", badge: "bg-[#dff5e8] text-[#12683f]", dot: "bg-[#1d9a60]" };
  if (["CANCELLED", "NO_SHOW"].includes(rawStatus)) return { label: rawStatus === "NO_SHOW" ? "Khách không đến" : "Đã hủy", badge: "bg-[#eee9e5] text-[#6f625b]", dot: "bg-[#9b8d84]" };
  return { label: "Đã xác nhận", badge: "bg-[#e6f0ff] text-[#2452b8]", dot: "bg-[#3b72d9]" };
}

export function AdminCalendarOperations() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const requests = useAdminBookingRequests();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(today));
  const [dayPart, setDayPart] = useState<DayPart>("all");
  const [branchId, setBranchId] = useState(session?.branchId ?? "all");
  const detailRef = useRef<HTMLElement>(null);

  const events = useMemo<CalendarEvent[]>(() => requests.map((request) => ({
    code: request.bookingCode,
    customer: request.customerName,
    phone: request.customerPhone,
    service: request.serviceLabel,
    therapist: request.therapistName,
    room: request.roomName || "Chờ xếp phòng",
    branchId: request.branchId,
    start: new Date(request.timeIso),
    end: new Date(new Date(request.timeIso).getTime() + request.durationMin * 60_000),
    amount: request.totalAmount,
    deposit: request.depositAmount,
    rawStatus: request.rawStatus,
  })), [requests]);

  if (!session) return null;

  const allowedBranch = session.role === "OWNER" ? branchId : session.branchId ?? branches[0].id;
  const monthRange = { start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) };
  const calendarRange = {
    start: startOfWeek(monthRange.start, { weekStartsOn: 1 }),
    end: endOfWeek(monthRange.end, { weekStartsOn: 1 }),
  };
  const calendarDays = eachDayOfInterval(calendarRange);
  const timeFiltered = events.filter((event) => inDayPart(event.start, dayPart));
  const scopedEvents = timeFiltered.filter((event) => allowedBranch === "all" || event.branchId === allowedBranch);
  const monthEvents = scopedEvents.filter((event) => isWithinInterval(event.start, monthRange));
  const selectedEvents = scopedEvents
    .filter((event) => isSameDay(event.start, selectedDay))
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  const waitingCount = monthEvents.filter((event) => event.rawStatus === "PENDING").length;
  const activeCount = monthEvents.filter((event) => ["CHECKED_IN", "IN_SERVICE"].includes(event.rawStatus)).length;
  const expectedRevenue = monthEvents
    .filter((event) => !["CANCELLED", "NO_SHOW"].includes(event.rawStatus))
    .reduce((sum, event) => sum + event.amount, 0);
  const visibleBranches = branches.filter((branch) => session.role === "OWNER" || branch.id === session.branchId);

  function changeMonth(next: Date) {
    const month = startOfMonth(next);
    setVisibleMonth(month);
    setSelectedDay(isSameMonth(today, month) ? startOfDay(today) : month);
  }

  function selectCalendarDay(day: Date) {
    if (!isSameMonth(day, visibleMonth)) setVisibleMonth(startOfMonth(day));
    setSelectedDay(startOfDay(day));
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl border border-[#d8b46a]/60 bg-white shadow-[0_12px_32px_rgba(74,44,28,0.08)]">
        <div className="bg-gradient-to-r from-[#291714] via-[#63291d] to-[#9f1d20] px-3.5 py-3 text-white sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f5d982] ring-1 ring-white/15"><CalendarDays size={17} /></span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#f5d982]">{session.role === "OWNER" ? <ShieldCheck size={11} /> : <Building2 size={11} />} {session.branchLabel}</p>
                <h1 className="truncate text-base font-semibold sm:text-lg">Lịch vận hành</h1>
              </div>
            </div>
            <button type="button" onClick={() => changeMonth(today)} className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold">Hôm nay</button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
            <span className="rounded-full bg-white/12 px-2.5 py-1">{monthEvents.length} Booking</span>
            <span className="rounded-full bg-[#fff0c9] px-2.5 py-1 text-[#805914]">{waitingCount} chờ xác nhận</span>
            {activeCount ? <span className="rounded-full bg-[#ffe0de] px-2.5 py-1 text-[#9f1d20]">{activeCount} đang phục vụ</span> : null}
            <span className="rounded-full bg-[#e7f7ed] px-2.5 py-1 text-[#12683f]">Dự kiến {formatMoney(expectedRevenue)}</span>
          </div>
        </div>

        <div className="border-b border-[#eadbd1] bg-[#fffdfb] p-2.5 sm:px-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(addMonths(visibleMonth, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadbd1] bg-white text-[#7a2318]"><ChevronLeft size={17} /></button>
            <label className="relative block min-w-0">
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold capitalize text-[#291714]">{monthTitle(visibleMonth)}</span>
              <input aria-label="Chọn tháng" type="month" value={format(visibleMonth, "yyyy-MM")} onChange={(event) => event.target.value && changeMonth(new Date(`${event.target.value}-01T12:00:00`))} className="h-9 w-full cursor-pointer rounded-xl border border-[#eadbd1] bg-white text-center text-transparent [color-scheme:light]" />
            </label>
            <button type="button" aria-label="Tháng sau" onClick={() => changeMonth(addMonths(visibleMonth, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadbd1] bg-white text-[#7a2318]"><ChevronRight size={17} /></button>
          </div>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_132px] gap-2">
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto rounded-xl bg-[#f7f1ed] p-1">
              {session.role === "OWNER" ? <button type="button" onClick={() => setBranchId("all")} className={cn("shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold", allowedBranch === "all" ? "bg-[#291714] text-white shadow-sm" : "text-[#665b55]")}>Tất cả</button> : null}
              {visibleBranches.map((branch) => {
                const count = timeFiltered.filter((event) => event.branchId === branch.id && isWithinInterval(event.start, monthRange)).length;
                const active = allowedBranch === branch.id;
                return <button key={branch.id} type="button" onClick={() => session.role === "OWNER" && setBranchId(branch.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold", active ? "bg-[#9f1d20] text-white shadow-sm" : "text-[#665b55]")}><i className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-[#f5d982]" : "bg-[#b9862c]")} />{branch.label}<span className={cn("rounded-full px-1.5 text-[8px]", active ? "bg-white/15" : "bg-white")}>{count}</span></button>;
              })}
            </div>
            <CompactSelect value={dayPart} onValueChange={(value) => setDayPart(value as DayPart)} dialogTitle="Lọc lịch theo ca" triggerClassName="min-h-10 rounded-xl py-2" options={DAY_PARTS} />
          </div>
        </div>

        <div className="relative bg-gradient-to-b from-[#fffaf4] to-white px-2 pb-3 pt-5 sm:px-4 sm:pb-4">
          <div aria-hidden className="absolute left-4 right-4 top-0 flex -translate-y-1/2 justify-around">
            {Array.from({ length: 7 }, (_, index) => <span key={index} className="h-5 w-2 rounded-full border border-[#7b5129] bg-gradient-to-b from-[#f6d989] via-[#a8752e] to-[#f5d982] shadow-sm" />)}
          </div>
          <div className="grid grid-cols-7 border-b border-[#eadbd1] pb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a6a58]">
            {WEEKDAYS.map((day) => <span key={day} className={day === "CN" ? "text-[#9f1d20]" : ""}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((day) => {
              const dayEvents = scopedEvents.filter((event) => isSameDay(event.start, day));
              const selected = isSameDay(day, selectedDay);
              const currentMonth = isSameMonth(day, visibleMonth);
              const pending = dayEvents.filter((event) => event.rawStatus === "PENDING").length;
              const serving = dayEvents.filter((event) => ["CHECKED_IN", "IN_SERVICE"].includes(event.rawStatus)).length;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-label={`Ngày ${format(day, "dd/MM")}${dayEvents.length ? `, ${dayEvents.length} lịch` : ", chưa có lịch"}`}
                  aria-pressed={selected}
                  onClick={() => selectCalendarDay(day)}
                  className={cn(
                    "relative min-h-[66px] rounded-xl border px-1 py-1.5 text-left transition sm:min-h-[88px] sm:px-2",
                    selected ? "border-[#9f1d20] bg-[#fff0ed] shadow-[0_5px_15px_rgba(159,29,32,0.13)] ring-1 ring-[#9f1d20]/20" : "border-[#eee4dd] bg-white hover:border-[#d8b46a]",
                    !currentMonth && "opacity-40",
                  )}
                >
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", isToday(day) ? "bg-[#9f1d20] text-white" : selected ? "text-[#9f1d20]" : "text-[#3c2d27]")}>{format(day, "d")}</span>
                  {dayEvents.length ? <div className="mt-1 flex items-center justify-center gap-1 sm:mt-2"><strong className="text-[11px] text-[#7a2318] sm:text-xs">{dayEvents.length}</strong><i className="h-2 w-2 rounded-full bg-[#1d9a60]" /><span className="sr-only">lịch</span>{pending ? <i title={`${pending} chờ xác nhận`} className="h-1.5 w-1.5 rounded-full bg-[#d99a22]" /> : null}{serving ? <i title={`${serving} đang phục vụ`} className="h-1.5 w-1.5 rounded-full bg-[#c33838]" /> : null}</div> : <span className="mt-2 block text-center text-[8px] text-[#c1b5ae]">—</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-[8px] text-[#756861]"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#d99a22]" />Chờ xác nhận</span><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#c33838]" />Đang phục vụ</span><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#1d9a60]" />Đã xếp lịch</span></div>
        </div>
      </section>

      <section ref={detailRef} className="mt-3 scroll-mt-28 overflow-hidden rounded-2xl border border-[#d8b46a]/60 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#eadbd1] bg-[#fffaf4] px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9f1d20]">Chi tiết trong ngày</p>
            <h2 className="mt-0.5 truncate text-sm font-semibold capitalize">{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(selectedDay)}</h2>
          </div>
          <span className="shrink-0 rounded-full bg-[#291714] px-2.5 py-1 text-[9px] font-semibold text-white">{selectedEvents.length} lịch</span>
        </div>
        {selectedEvents.length === 0 ? (
          <div className="px-4 py-9 text-center"><CalendarDays className="mx-auto text-[#c9ab91]" size={25} /><p className="mt-2 text-xs font-medium text-[#665b55]">Ngày này chưa có Booking.</p><p className="mt-1 text-[10px] text-[#9a8b83]">Chạm ngày khác trên cuốn lịch để xem nhanh lịch vận hành.</p></div>
        ) : (
          <div className="divide-y divide-[#f0e6df]">
            {selectedEvents.map((event) => {
              const status = statusView(event.rawStatus);
              const branch = branches.find((item) => item.id === event.branchId);
              return <article key={event.code} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2.5 px-3 py-3 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:px-4">
                <div className="rounded-xl bg-[#291714] px-1.5 py-2 text-center text-white"><strong className="block text-xs">{format(event.start, "HH:mm")}</strong><span className="mt-0.5 block text-[8px] text-white/60">{format(event.end, "HH:mm")}</span></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-xs font-semibold">{event.customer}</p><span className={cn("rounded-full px-2 py-1 text-[8px] font-semibold", status.badge)}>{status.label}</span></div>
                  <p className="mt-1 truncate text-[10px] font-medium text-[#4b3b34]">{event.service}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#7d6e66]"><span className="flex items-center gap-1"><UserRound size={10} className="text-[#9f1d20]" />{event.therapist}</span><span className="flex items-center gap-1"><MapPin size={10} className="text-[#9f1d20]" />{branch?.label} · {event.room}</span><span className="flex items-center gap-1"><Clock3 size={10} className="text-[#9f1d20]" />{event.phone} · {displayBookingCode(event.code)}</span></div>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-3 rounded-lg bg-[#fff7ec] px-2.5 py-2 text-[9px] sm:col-auto sm:min-w-[170px] sm:flex-col sm:items-end sm:bg-transparent sm:p-0"><span>Đã cọc <strong className="text-[#16784a]">{formatMoney(event.deposit)}</strong></span><strong className="text-[11px]">{formatMoney(event.amount)}</strong></div>
              </article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
