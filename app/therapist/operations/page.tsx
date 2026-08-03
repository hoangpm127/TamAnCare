import { BedDouble, BriefcaseBusiness, Clock3, UserRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

function dayRange(now: Date) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { start: new Date(`${key}T00:00:00+07:00`), end: new Date(`${key}T23:59:59.999+07:00`) };
}
function time(value: Date) { return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }); }

export default async function TherapistOperationsPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) return null;
  const now = new Date();
  const day = dayRange(now);
  const [bookings, therapists, business] = await Promise.all([
    db.booking.findMany({ where: { branchId: therapist.branchId, startTime: { gte: day.start, lte: day.end }, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, include: { customer: true, service: true, therapist: true, room: true }, orderBy: { startTime: "asc" } }),
    db.therapist.findMany({ where: { branchId: therapist.branchId, status: "ACTIVE" }, select: { id: true, fullName: true, shiftLabel: true }, orderBy: { fullName: "asc" } }),
    db.officeEvent.findMany({ where: { branchId: therapist.branchId, startsAt: { gte: day.start, lte: day.end }, status: { in: ["READY", "IN_SERVICE", "AWAITING_BALANCE"] } }, orderBy: { startsAt: "asc" } }),
  ]);
  const busyIds = new Set(bookings.filter((item) => item.startTime <= now && item.endTime > now && ["CHECKED_IN", "IN_SERVICE"].includes(item.status)).map((item) => item.therapistId).filter(Boolean));

  return <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6">
    <header className="rounded-3xl bg-gradient-to-r from-[#173d36] via-[#17634a] to-[#22845a] p-5 text-center text-white shadow-xl"><p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d9f6e5]"><UsersRound size={15} /> Điều phối tại cơ sở</p><h1 className="mt-2 text-xl font-semibold">{session.branchLabel}</h1><p className="mt-1 text-[10px] text-white/70">{bookings.length} lịch hôm nay · {busyIds.size} KTV đang phục vụ · {business.length} đoàn Business</p></header>
    <section className="mt-3 rounded-2xl border border-[#8fd3ad] bg-white p-3.5 shadow-sm"><h2 className="text-sm font-semibold">KTV bận/rảnh tức thì</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{therapists.map((item) => { const busy = busyIds.has(item.id); return <article key={item.id} className={busy ? "rounded-xl border border-[#efb5b2] bg-[#fff0ef] p-2.5" : "rounded-xl border border-[#8fd3ad] bg-[#edf9f2] p-2.5"}><div className="flex items-center justify-between gap-1"><p className="truncate text-[10px] font-semibold">{item.fullName}</p><span className={busy ? "h-2.5 w-2.5 shrink-0 rounded-full bg-[#d34a4a]" : "h-2.5 w-2.5 shrink-0 rounded-full bg-[#29a064]"} /></div><p className="mt-1 text-[8px] text-[#8a7a72]">{item.shiftLabel} · {busy ? "Đang bận" : "Đang rảnh"}</p></article>; })}</div></section>
    <section className="mt-3 rounded-2xl border border-[#d8b46a]/55 bg-white p-3.5 shadow-sm"><h2 className="text-sm font-semibold">Dòng điều phối hôm nay</h2><div className="mt-3 space-y-2">{bookings.map((booking) => <article key={booking.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-[#faf7f4] p-2.5"><span className="rounded-lg bg-[#173d36] py-1.5 text-center text-[9px] font-bold text-white">{time(booking.startTime)}</span><div className="min-w-0"><p className="truncate text-[10px] font-semibold">{booking.customer.fullName} · {booking.service.name}</p><p className="mt-1 truncate text-[8px] text-[#708078]"><UserRound size={9} className="mr-1 inline" />{booking.therapist?.fullName ?? "Chờ KTV"} · <BedDouble size={9} className="ml-1 mr-1 inline" />{booking.room?.name ?? "Chờ giường"}</p></div><span className="text-[8px] font-semibold text-[#16784a]">{booking.status === "IN_SERVICE" ? "Đang phục vụ" : "Đã xếp"}</span></article>)}{business.map((event) => <article key={event.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-[#eef5ff] p-2.5"><span className="rounded-lg bg-[#2452b8] py-1.5 text-center text-[9px] font-bold text-white">{time(event.startsAt)}</span><div className="min-w-0"><p className="truncate text-[10px] font-semibold"><BriefcaseBusiness size={10} className="mr-1 inline" />{event.companyName}</p><p className="mt-1 truncate text-[8px] text-[#6f7784]">{event.location} · {event.requiredTherapists} KTV</p></div><Clock3 size={14} className="text-[#2452b8]" /></article>)}</div></section>
  </div>;
}
