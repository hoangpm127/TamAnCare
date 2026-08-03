"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, ChevronDown, ChevronRight, CircleDollarSign, ExternalLink, Search, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import { usePublicCatalog } from "@/lib/catalog-store";
import { branches as demoBranches } from "@/lib/demo-data";
import { useAdminSession } from "@/components/admin-session-provider";
import { CompactSelect } from "@/components/compact-select";
import { cn, formatMoney } from "@/lib/utils";

type CustomerRecord = {
  id: string;
  fullName: string;
  phone: string;
  segment: string;
  totalVisits: number;
  totalSpend: number;
  internalNote: string | null;
  firstSource: string | null;
  lastVisitAt: string | null;
  favoriteTherapist: { fullName: string } | null;
  packages: Array<{ id: string; packagePlan: { name: string } }>;
  bookings: Array<{
    id: string;
    branchId: string;
    startTime: string;
    totalAmount: number;
    status: string;
    branch: { name: string };
    service: { name: string };
    therapist: { fullName: string } | null;
  }>;
};

function segmentLabel(segment: string) {
  if (segment === "VIP") return "Khách VIP";
  if (segment === "RETURNING") return "Khách thân thiết";
  if (segment === "LONG_TERM") return "Khách mua thẻ dài hạn";
  if (segment === "BUSINESS") return "Khách doanh nghiệp";
  if (segment === "AFFILIATE") return "Đối tác Affiliate";
  return "Khách mới";
}

function customerGroups(customer: { segment: string; totalVisits: number; totalSpend: number; relationship: string; note: string }) {
  const groups = new Set([customer.segment]);
  const note = customer.note.toLocaleLowerCase("vi");
  if (customer.totalVisits >= 8 || customer.totalSpend >= 3000000 || /gói dài hạn|thẻ thành viên/.test(note)) groups.add("LONG_TERM");
  if (customer.relationship === "BOSS" || /doanh nghiệp|công ty|văn phòng/.test(note)) groups.add("BUSINESS");
  if (customer.relationship === "PARTNER" || /affiliate|giới thiệu đối tác/.test(note)) groups.add("AFFILIATE");
  return [...groups];
}

export function AdminCustomerTimeline() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"summary" | "full">("summary");

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/customers?limit=300", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải CRM");
        if (active) setCustomerRecords(data.customers ?? []);
      } catch {
        // Giữ dữ liệu DB gần nhất khi thiết bị tạm mất kết nối.
      }
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session]);

  const allCustomers = useMemo(() => customerRecords.map((customer) => {
    const relationship = customer.firstSource?.startsWith("CRM_")
      ? customer.firstSource.split(":")[0].replace("CRM_", "")
      : "WALK_IN";
    const latest = customer.bookings[0];
    return {
      ...customer,
      favoriteTherapist: customer.favoriteTherapist?.fullName ?? latest?.therapist?.fullName ?? "Chưa phân công",
      lastVisit: customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString("vi-VN") : latest ? new Date(latest.startTime).toLocaleDateString("vi-VN") : "Chưa phát sinh lịch",
      note: customer.internalNote || (customer.packages.length ? `Đang sử dụng ${customer.packages.map((item) => item.packagePlan.name).join(", ")}.` : "Chưa có ghi chú chăm sóc."),
      branchId: latest?.branchId ?? customer.firstSource?.split(":")[1],
      relationship,
    };
  }), [customerRecords]);

  const scopedCustomers = useMemo(() => {
    if (!session) return [];
    return allCustomers.filter((customer) => {
      const belongsToScope = session.role === "OWNER" || customer.branchId === session.branchId || customer.bookings.some((booking) => booking.branchId === session.branchId);
      const matchesQuery = `${customer.fullName} ${customer.phone}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesSegment = segment === "ALL" || customerGroups(customer).includes(segment);
      return belongsToScope && matchesQuery && matchesSegment;
    }).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [allCustomers, query, segment, session]);

  if (!session) return null;
  const totalSpend = scopedCustomers.reduce((sum, customer) => sum + customer.totalSpend, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#291714] via-[#522417] to-[#8f241d] p-3.5 text-white shadow-sm">
        <div className="flex items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f5d982] ring-1 ring-white/15"><UsersRound size={18} /></span><div className="min-w-0"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f5d982]">{session.role === "OWNER" ? <ShieldCheck size={12} /> : <Building2 size={12} />} {session.branchLabel}</p><h1 className="mt-0.5 text-lg font-semibold">Dòng thời gian khách hàng</h1><p className="mt-0.5 line-clamp-1 text-[10px] text-white/70">Hồ sơ, giá trị và quan hệ chăm sóc theo từng khách.</p></div></div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-3 text-center"><div><strong className="block text-base">{scopedCustomers.length}</strong><span className="text-[9px] text-white/60">Khách trong phạm vi</span></div><div><strong className="block text-base">{scopedCustomers.reduce((sum, customer) => sum + customer.totalVisits, 0)}</strong><span className="text-[9px] text-white/60">Tổng lượt ghé</span></div><div><strong className="block text-xs text-[#f5d982]">{formatMoney(totalSpend)}</strong><span className="text-[9px] text-white/60">Tổng chi tiêu</span></div></div>
      </section>

      <section className="mt-3 rounded-2xl border border-[#d8b46a]/60 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-2 rounded-xl border border-[#eadbd1] px-3 py-2.5"><Search size={15} className="text-[#9f1d20]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Tìm tên hoặc số điện thoại" /></label>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_106px] gap-2"><CompactSelect value={segment} onValueChange={setSegment} dialogTitle="Lọc nhóm khách hàng" triggerClassName="min-h-0 rounded-lg py-2 text-[11px]" options={[{ value: "ALL", label: "Tất cả nhóm khách" }, { value: "NEW", label: "Khách mới" }, { value: "RETURNING", label: "Khách thân thiết" }, { value: "VIP", label: "Khách VIP" }, { value: "LONG_TERM", label: "Khách mua thẻ dài hạn" }, { value: "BUSINESS", label: "Khách doanh nghiệp" }, { value: "AFFILIATE", label: "Đối tác Affiliate" }]} /><div className="flex rounded-lg bg-[#f5eee9] p-0.5"><button type="button" onClick={() => setDetailMode("summary")} className={cn("flex-1 rounded-md px-1 py-1.5 text-[9px] font-semibold", detailMode === "summary" && "bg-white text-[#9f1d20] shadow-sm")}>Tóm tắt</button><button type="button" onClick={() => setDetailMode("full")} className={cn("flex-1 rounded-md px-1 py-1.5 text-[9px] font-semibold", detailMode === "full" && "bg-white text-[#9f1d20] shadow-sm")}>Đầy đủ</button></div></div>
      </section>

      <section className="mt-3 space-y-3">
        {scopedCustomers.map((customer) => {
          const isOpen = expanded === customer.id;
          const customerBookings = [...customer.bookings].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          const latestBranchId = customer.branchId ?? customerBookings[0]?.branchId;
          return (
            <article key={customer.id} className="relative overflow-hidden rounded-2xl border border-[#d8b46a]/60 bg-white shadow-sm">
              <button type="button" onClick={() => setExpanded(isOpen ? null : customer.id)} className="w-full p-3.5 text-left">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff2ef] text-[#9f1d20]"><UserRound size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{customer.fullName}</h2><p className="mt-0.5 text-[10px] text-[#8a7a72]">{customer.phone} · {branches.find((branch) => branch.id === latestBranchId)?.label ?? "Toàn hệ thống"}</p></div><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff7ec] text-[#7a3e1d]">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span></div><div className="mt-2 flex flex-wrap gap-1.5">{customerGroups(customer).slice(0, 2).map((group) => <span key={group} className="rounded-full bg-[#fff7df] px-2 py-1 text-[9px] font-semibold text-[#805914]">{segmentLabel(group)}</span>)}<span className="rounded-full bg-[#f4f0ed] px-2 py-1 text-[9px] text-[#665b55]">Ghé gần nhất {customer.lastVisit}</span></div></div></div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg bg-[#fffaf6] py-2"><strong className="block text-xs">{customer.totalVisits}</strong><span className="text-[9px] text-[#8a7a72]">Lượt ghé</span></div><div className="rounded-lg bg-[#fffaf6] py-2"><strong className="block text-xs">{formatMoney(customer.totalSpend)}</strong><span className="text-[9px] text-[#8a7a72]">Chi tiêu</span></div><div className="rounded-lg bg-[#fffaf6] py-2"><strong className="block truncate px-1 text-xs">{customer.favoriteTherapist}</strong><span className="text-[9px] text-[#8a7a72]">KTV quen</span></div></div>
              </button>

              {isOpen ? <div className="border-t border-[#eadbd1] bg-[#fffdfb] p-3.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#eadbd1] bg-white p-3"><p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={13} className="text-[#9f1d20]" /> Nhu cầu & ghi chú</p><p className="mt-1.5 text-[11px] leading-4 text-[#665b55]">{customer.note}</p></div>
                  <div className="rounded-xl border border-[#eadbd1] bg-white p-3"><p className="flex items-center gap-1.5 text-xs font-semibold"><CircleDollarSign size={13} className="text-[#9f1d20]" /> Giá trị khách hàng</p><div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><span className="rounded-lg bg-[#fff7ec] p-2">Trung bình/lượt<strong className="mt-0.5 block text-xs">{formatMoney(Math.round(customer.totalSpend / Math.max(1, customer.totalVisits)))}</strong></span><span className="rounded-lg bg-[#fff7ec] p-2">Nhóm chăm sóc<strong className="mt-0.5 block text-xs">{segmentLabel(customer.segment)}</strong></span></div></div>
                  {detailMode === "full" ? <div className="rounded-xl border border-[#eadbd1] bg-white p-3 sm:col-span-2"><p className="flex items-center gap-1.5 text-xs font-semibold"><CalendarClock size={13} className="text-[#9f1d20]" /> Lịch sử phục vụ gần đây</p><div className="mt-2 space-y-2">{customerBookings.length === 0 ? <p className="text-[10px] text-[#8a7a72]">Chưa có lịch sử.</p> : customerBookings.map((booking) => <div key={booking.id} className="rounded-lg bg-[#fffaf6] p-2.5"><div className="flex justify-between gap-2"><p className="text-[10px] font-semibold">{booking.service.name}</p><span className="text-[9px] text-[#8a7a72]">{new Date(booking.startTime).toLocaleDateString("vi-VN")}</span></div><p className="mt-1 text-[9px] text-[#665b55]">{booking.therapist?.fullName ?? "Cơ sở sắp xếp"} · {formatMoney(booking.totalAmount)} · {booking.status === "COMPLETED" ? "Hoàn thành" : "Đã đặt"}</p></div>)}</div></div> : null}
                </div>
                <Link href={`/admin/customers/${customer.id}`} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#9f1d20] py-2.5 text-xs font-semibold text-white">Mở hồ sơ đầy đủ <ExternalLink size={13} /></Link>
              </div> : null}
            </article>
          );
        })}
        {scopedCustomers.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8b46a] bg-white py-10 text-center text-xs text-[#8a7a72]">Không tìm thấy khách hàng phù hợp.</div> : null}
      </section>
    </div>
  );
}
