import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, MapPin, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = { AWAITING_DEPOSIT: "Chờ cọc", DEPOSIT_CONFIRMED: "Chờ phân công", READY: "Sẵn sàng", IN_SERVICE: "Đang phục vụ", AWAITING_BALANCE: "Chờ thanh toán", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy" };

export default async function TherapistBusinessListPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) return null;
  const events = await db.officeEvent.findMany({ where: { leadTherapistId: therapist.id, status: { not: "CANCELLED" } }, include: { branch: true }, orderBy: { startsAt: "desc" }, take: 50 });
  return <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><header className="rounded-[2rem] bg-gradient-to-br from-[#241614] via-[#5b2d1e] to-[#9b1f24] p-6 text-white shadow-xl"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f6dd93]"><BriefcaseBusiness size={16} /> Tâm An Business</p><h1 className="mt-2 text-2xl font-semibold">Các đoàn bạn phụ trách</h1><p className="mt-1 text-sm text-white/70">QR riêng, đồng hồ trực tiếp và công nợ của từng buổi triển khai.</p></header><div className="mt-4 grid gap-3 sm:grid-cols-2">{events.map((event) => <Link key={event.id} href={`/therapist/business/${event.eventCode}`} className="rounded-3xl border border-[#eadbd1] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{event.companyName}</p><p className="mt-1 text-xs text-[#8a7a72]">{event.eventCode}</p></div><span className="rounded-full bg-[#fff2ef] px-2.5 py-1 text-[10px] font-bold text-[#d13f1f]">{labels[event.status] ?? event.status}</span></div><div className="mt-4 space-y-2 text-xs text-[#665b55]"><p className="flex gap-2"><MapPin size={14} className="shrink-0 text-[#d13f1f]" />{event.location}</p><p className="flex gap-2"><CalendarClock size={14} className="text-[#d13f1f]" />{event.startsAt.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })}</p><p className="flex gap-2"><Users size={14} className="text-[#d13f1f]" />{event.headcount} người · {event.requiredTherapists} KTV</p></div></Link>)}{events.length === 0 ? <p className="col-span-full rounded-3xl border border-dashed border-[#d9c8bc] bg-white p-8 text-center text-sm text-[#76665d]">Bạn chưa được phân công đoàn Business nào.</p> : null}</div></div>;
}
