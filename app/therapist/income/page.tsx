import { CircleDollarSign, HandCoins, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

function monthRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(now);
  const [year, month] = parts.split("-").map(Number);
  return { start: new Date(`${parts}-01T00:00:00+07:00`), end: new Date(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01T00:00:00+07:00`) };
}

export default async function TherapistIncomePage() {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) return null;
  const range = monthRange(new Date());
  const [bookings, tips] = await Promise.all([
    db.booking.findMany({ where: { therapistId: therapist.id, completedAt: { gte: range.start, lt: range.end }, status: "COMPLETED" }, select: { therapistFee: true } }),
    db.tipPayout.findMany({ where: { therapistId: therapist.id }, include: { booking: { include: { customer: true, service: true } }, officeEvent: true }, orderBy: { serviceDate: "desc" }, take: 30 }),
  ]);
  const monthTips = tips.filter((item) => item.serviceDate >= range.start && item.serviceDate < range.end);
  const responsibility = bookings.reduce((sum, item) => sum + item.therapistFee, 0);
  const paid = monthTips.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
  const pending = monthTips.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + item.amount, 0);

  return <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#291714] via-[#63301f] to-[#d13f1f] p-5 text-center text-white shadow-xl">
      <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f5d982]"><CircleDollarSign size={15} /> Thu nhập cá nhân</p>
      <h1 className="mt-2 text-xl font-semibold">Minh bạch từng khoản của {therapist.fullName}</h1>
      <p className="mt-1 text-[10px] text-white/70">Tip hoàn toàn tùy tâm và khách trao trực tiếp; số liệu bên dưới chỉ giữ lịch sử cũ nếu có.</p>
      <div className="mt-4 grid grid-cols-3 gap-2"><IncomeMetric label="Thu nhập trách nhiệm" value={responsibility} /><IncomeMetric label="Tip đã trả" value={paid} /><IncomeMetric label="Tip chờ trả" value={pending} /></div>
    </header>
    <section className="mt-3 rounded-2xl border border-[#d8b46a]/55 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-1.5 text-sm font-semibold"><HandCoins size={16} className="text-[#805914]" /> Lịch sử Tip KTV</h2><p className="mt-0.5 text-[9px] text-[#8a7a72]">Theo khách, dịch vụ và trạng thái chi trả</p></div><WalletCards size={19} className="text-[#d13f1f]" /></div>
      <div className="mt-3 divide-y divide-[#f0e6df]">{tips.map((tip) => <article key={tip.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{tip.booking?.customer.fullName ?? tip.officeEvent?.companyName ?? "Tâm An Care"}</p><p className="mt-0.5 truncate text-[9px] text-[#8a7a72]">{tip.booking?.service.name ?? "Tâm An Business"} · {tip.serviceDate.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p></div><div className="shrink-0 text-right"><strong className="text-xs text-[#805914]">{formatMoney(tip.amount)}</strong><p className={tip.status === "PAID" ? "text-[8px] font-semibold text-[#16784a]" : "text-[8px] font-semibold text-[#d13f1f]"}>{tip.status === "PAID" ? "Đã chi cuối ngày" : tip.status === "PENDING" ? "Chờ chi cuối ngày" : "Đã hủy"}</p></div></article>)}{tips.length === 0 ? <p className="py-8 text-center text-xs text-[#8a7a72]">Chưa có khoản Tip nào được ghi nhận.</p> : null}</div>
    </section>
  </div>;
}

function IncomeMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 px-1.5 py-3"><strong className="block truncate text-[11px] sm:text-sm">{formatMoney(value)}</strong><span className="mt-1 block text-[7px] leading-3 text-white/65 sm:text-[8px]">{label}</span></div>;
}
