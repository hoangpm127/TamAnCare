"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Sparkles, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

type RegularShift = {
  id: string;
  bookingCode: string;
  dayKey: string;
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  roomName: string;
  relationship: "SELF" | "FRIEND" | "BOSS";
  relationshipLabel: string;
  requestNote: string;
  statusLabel: string;
  aiAdvice: string[];
};

type BusinessShift = {
  id: string;
  eventCode: string;
  dayKey: string;
  startsAt: string;
  endsAt: string;
  companyName: string;
  location: string;
  headcount: number;
  statusLabel: string;
  serviceLabel: string;
  aiAdvice: string[];
};

type CalendarDay = { key: string; dayNumber: string; fullLabel: string; isToday: boolean; isCurrentMonth: boolean };
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

export function TherapistCalendarSchedule({
  days,
  regular,
  business,
  previousMonth,
  nextMonth,
  monthLabel,
  currentMonthKey,
}: {
  days: CalendarDay[];
  regular: RegularShift[];
  business: BusinessShift[];
  previousMonth: string;
  nextMonth: string;
  monthLabel: string;
  currentMonthKey: string;
}) {
  const defaultDay = days.find((day) => day.isToday)?.key ?? days.find((day) => day.isCurrentMonth && (regular.some((item) => item.dayKey === day.key) || business.some((item) => item.dayKey === day.key)))?.key ?? days.find((day) => day.isCurrentMonth)?.key ?? days[0].key;
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const selected = days.find((day) => day.key === selectedDay) ?? days[0];
  const selectedRegular = useMemo(() => regular.filter((item) => item.dayKey === selectedDay), [regular, selectedDay]);
  const selectedBusiness = useMemo(() => business.filter((item) => item.dayKey === selectedDay), [business, selectedDay]);
  const monthRegular = regular.filter((item) => item.dayKey.startsWith(currentMonthKey));
  const monthBusiness = business.filter((item) => item.dayKey.startsWith(currentMonthKey));

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-white shadow-[0_12px_32px_rgba(74,44,28,0.08)]">
        <div className="bg-gradient-to-r from-[#291714] via-[#63291d] to-[#c64b32] px-3.5 py-3 text-white sm:px-5">
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><CalendarDays size={17} /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#e7c878]">Lịch cá nhân KTV</p><h1 className="truncate text-base font-semibold">Lịch làm việc của tôi</h1></div></div><Link href="/therapist" className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold">Hôm nay</Link></div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold"><span className="rounded-full bg-white/12 px-2.5 py-1">{monthRegular.length + monthBusiness.length} lịch</span><span className="rounded-full bg-[#dff5e8] px-2.5 py-1 text-[#0b6248]">{monthRegular.length} tại cơ sở</span><span className="rounded-full bg-[#dbeaff] px-2.5 py-1 text-[#2452b8]">{monthBusiness.length} Business</span></div>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#e7d6ca] bg-[#fffdfb] p-2.5 sm:px-4">
          <Link href={`/therapist?month=${previousMonth}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7d6ca] bg-white text-[#8c332a]" aria-label="Tháng trước"><ChevronLeft size={17} /></Link>
          <div className="text-center text-sm font-semibold capitalize text-[#291714]">{monthLabel}</div>
          <Link href={`/therapist?month=${nextMonth}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7d6ca] bg-white text-[#8c332a]" aria-label="Tháng sau"><ChevronRight size={17} /></Link>
        </div>

        <div className="relative bg-gradient-to-b from-[#fffaf4] to-white px-2 pb-3 pt-5 sm:px-4 sm:pb-4">
          <div aria-hidden className="absolute left-4 right-4 top-0 flex -translate-y-1/2 justify-around">{Array.from({ length: 7 }, (_, index) => <span key={index} className="h-5 w-2 rounded-full border border-[#7b5129] bg-gradient-to-b from-[#f6d989] via-[#a8752e] to-[#e7c878] shadow-sm" />)}</div>
          <div className="grid grid-cols-7 border-b border-[#e7d6ca] pb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a6a58]">{WEEKDAYS.map((day) => <span key={day} className={day === "CN" ? "text-[#c64b32]" : ""}>{day}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((day) => {
            const careCount = regular.filter((item) => item.dayKey === day.key).length;
            const businessCount = business.filter((item) => item.dayKey === day.key).length;
            const active = selectedDay === day.key;
            return (
              <button key={day.key} type="button" onClick={() => setSelectedDay(day.key)} className={cn("relative min-h-[70px] rounded-xl border px-1 py-1.5 text-left transition sm:min-h-[92px] sm:px-2", active ? "border-[#c64b32] bg-[#fae9e4] shadow-[0_5px_15px_rgba(159,29,32,0.13)] ring-1 ring-[#c64b32]/20" : "border-[#eee4dd] bg-white hover:border-[#d2ad5d]", !day.isCurrentMonth && "opacity-40")} aria-pressed={active} aria-label={`${day.fullLabel}: ${careCount} lịch cơ sở, ${businessCount} đoàn Business`}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", day.isToday ? "bg-[#c64b32] text-white" : active ? "text-[#c64b32]" : "text-[#3c2d27]")}>{day.dayNumber}</span>
                <span className="mt-1 grid grid-cols-2 gap-0.5 sm:mt-2"><b title="Lịch tại cơ sở" className="flex items-center justify-center gap-0.5 rounded-md bg-[#dff5e8] px-0.5 py-1 text-[8px] text-[#0b6248]"><i className="h-1.5 w-1.5 rounded-full bg-[#228965]" />{careCount}</b><b title="Đoàn Business" className="flex items-center justify-center gap-0.5 rounded-md bg-[#dbeaff] px-0.5 py-1 text-[8px] text-[#2452b8]"><i className="h-1.5 w-1.5 rounded-full bg-[#4b8ee8]" />{businessCount}</b></span>
              </button>
            );
          })}
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-4 text-[8px] text-[#756861]"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#228965]" /> Lịch tại cơ sở</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#4b8ee8]" /> Đoàn Business</span></div>
        </div>
      </section>

      <section className="mt-3 overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-[#e7d6ca] bg-[#fffaf4] px-3.5 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Chi tiết trong ngày</p><h2 className="mt-0.5 text-sm font-semibold capitalize">{selected.fullLabel}</h2></div><span className="rounded-full bg-[#291714] px-2.5 py-1 text-[9px] font-semibold text-white">{selectedRegular.length + selectedBusiness.length} lịch</span></div>

        <div className="space-y-3 p-3 sm:p-4">
          {selectedRegular.map((shift) => <RegularShiftCard key={shift.id} shift={shift} />)}
          {selectedBusiness.map((shift) => <BusinessShiftCard key={shift.id} shift={shift} />)}
          {!selectedRegular.length && !selectedBusiness.length ? <p className="rounded-xl border border-dashed border-[#d9c8bc] p-7 text-center text-xs text-[#826f66]">Ngày này chưa có lịch được phân công.</p> : null}
        </div>
      </section>
    </>
  );
}

function RegularShiftCard({ shift }: { shift: RegularShift }) {
  const relationshipTone = shift.relationship === "BOSS" ? "bg-[#2f1d19] text-[#e7c878]" : shift.relationship === "FRIEND" ? "bg-[#fae9e4] text-[#c64b32]" : "bg-[#eff7f3] text-[#0b6248]";
  return (
    <article className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-[#fffdfb]">
      <div className="flex items-center justify-between gap-2 border-b border-[#f0e4dc] px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className="rounded-lg bg-[#291714] px-2 py-1.5 text-[9px] font-bold text-white">{time(shift.startTime)}–{time(shift.endTime)}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{shift.customerName}</p><p className="truncate text-[9px] text-[#826f66]">{shift.serviceName} · {shift.roomName}</p></div></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-[8px] font-bold", relationshipTone)}>{shift.relationshipLabel}</span></div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f8f4f1] p-2.5"><p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#6f625b]"><UserRound size={11} /> Yêu cầu cần lưu ý</p><p className="mt-1.5 text-[10px] leading-4 text-[#574b45]">{shift.requestNote}</p></div>
        <div className="rounded-xl bg-[#fff8e8] p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#76551d]">Tip KTV ngoài Bill</p><p className="mt-1 text-xs font-bold leading-4 text-[#76551d]">Khách trao trực tiếp nếu hài lòng</p><p className="mt-0.5 text-[8px] leading-3.5 text-[#8a7457]">Gợi ý từ 100.000đ/60 phút · 150.000đ/90 phút</p></div>
      </div>
      <div className="mx-3 mb-3 rounded-xl border border-[#cfe4d8] bg-gradient-to-r from-[#eff7f3] to-[#f8fcfa] p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#176a4c]"><Sparkles size={12} /> IQ Care căn dặn trước ca</p><ul className="mt-1.5 space-y-1">{shift.aiAdvice.map((advice) => <li key={advice} className="text-[10px] leading-4 text-[#48665a]">• {advice}</li>)}</ul></div>
      <Link href={`/therapist/bookings/${shift.bookingCode}`} className="flex items-center justify-center border-t border-[#f0e4dc] px-3 py-2.5 text-[10px] font-bold text-[#c64b32]">Mở hồ sơ ca & thao tác phục vụ <ChevronRight size={13} /></Link>
    </article>
  );
}

function BusinessShiftCard({ shift }: { shift: BusinessShift }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#b9d4f3] bg-[#f7fbff]">
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#183a64] to-[#2d68a8] px-3 py-2.5 text-white"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#bfe1ff]"><BriefcaseBusiness size={12} /> Tâm An Business</p><p className="mt-0.5 truncate text-xs font-semibold">{shift.companyName}</p></div><span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[8px] font-bold">{shift.statusLabel}</span></div>
      <div className="grid gap-1.5 p-3 text-[10px] text-[#526477] sm:grid-cols-2"><p className="flex items-center gap-1.5"><Clock3 size={12} className="text-[#2452b8]" />{time(shift.startsAt)}–{time(shift.endsAt)} · {shift.serviceLabel}</p><p className="flex items-center gap-1.5"><UsersRound size={12} className="text-[#2452b8]" />{shift.headcount} nhân sự</p><p className="flex items-start gap-1.5 sm:col-span-2"><MapPin size={12} className="mt-0.5 shrink-0 text-[#2452b8]" />{shift.location}</p></div>
      <div className="mx-3 mb-3 rounded-xl border border-[#c9dcf1] bg-white p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#2452b8]"><Sparkles size={12} /> IQ Care chuẩn bị đoàn</p><ul className="mt-1.5 space-y-1">{shift.aiAdvice.map((advice) => <li key={advice} className="text-[10px] leading-4 text-[#526477]">• {advice}</li>)}</ul></div>
      <Link href={`/therapist/business/${shift.eventCode}`} className="flex items-center justify-center border-t border-[#d7e5f5] px-3 py-2.5 text-[10px] font-bold text-[#2452b8]">Mở hồ sơ đoàn Business <ChevronRight size={13} /></Link>
    </article>
  );
}
