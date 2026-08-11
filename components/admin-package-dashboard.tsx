"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  History,
  Loader2,
  RefreshCw,
  Search,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type PackageOption = { id: string; name: string };
type DashboardTab = "SUMMARY" | "PURCHASES" | "LEDGER";

type PackageAnalytics = {
  generatedAt: string;
  summary: {
    cards: number;
    activeCards: number;
    owners: number;
    totalSessions: number;
    availableSessions: number;
    reservedSessions: number;
    usedSessions: number;
    referredCards: number;
    pendingPayments: number;
    confirmedRevenue: number;
    financialLedgerRevenue: number;
    reconciliationDifference: number;
  };
  perPlan: Array<{
    planId: string;
    planName: string;
    cards: number;
    activeCards: number;
    owners: number;
    availableSessions: number;
    reservedSessions: number;
    usedSessions: number;
    confirmedRevenue: number;
  }>;
  purchases: Array<{
    id: string;
    status: "ACTIVE" | "EXPIRED" | "PAUSED" | "USED_UP";
    sessionsTotal: number;
    sessionsRemaining: number;
    sessionsReserved: number;
    expiresAt: string;
    activatedAt: string | null;
    createdAt: string;
    planNameSnapshot: string | null;
    planPriceSnapshot: number | null;
    referrerInput: string | null;
    referrerName: string | null;
    referrerPhone: string | null;
    customer: { id: string; fullName: string; phone: string };
    referrerCustomer: { id: string; fullName: string; phone: string } | null;
    packagePlan: { id: string; name: string; price: number; sessions: number };
    campaign: { id: string; code: string; name: string } | null;
    paymentTransaction: {
      id: string;
      status: "PENDING" | "CONFIRMED" | "VOID" | "REFUNDED";
      amount: number;
      receivedAmount: number | null;
      method: string;
      paymentCode: string | null;
      externalReference: string | null;
      paidAt: string | null;
      createdAt: string;
    } | null;
    _count: { bookings: number; ledgerEntries: number };
  }>;
  ledger: Array<{
    id: string;
    event: string;
    availableDelta: number;
    reservedDelta: number;
    usedDelta: number;
    amount: number;
    description: string;
    occurredAt: string;
    customer: { id: string; fullName: string; phone: string };
    packagePlan: { id: string; name: string };
    booking: { id: string; bookingCode: string } | null;
    bookingGroup: { id: string; referenceCode: string } | null;
    paymentTransaction: { id: string; paymentCode: string | null; status: string } | null;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const PACKAGE_STATUS_LABELS = {
  ACTIVE: "Đang dùng",
  EXPIRED: "Hết hạn",
  PAUSED: "Chờ thanh toán",
  USED_UP: "Đã dùng hết",
} as const;

const PAYMENT_STATUS_LABELS = {
  PENDING: "Chờ đối soát",
  CONFIRMED: "Đã thanh toán",
  VOID: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
} as const;

const EVENT_LABELS: Record<string, string> = {
  PURCHASE_CREATED: "Tạo đơn mua gói",
  REFERRAL_CAPTURED: "Lưu người giới thiệu",
  ACTIVATED: "Kích hoạt gói",
  SESSION_RESERVED: "Giữ lượt đặt lịch",
  SESSION_RELEASED: "Hoàn lượt",
  SESSION_USED: "Đã sử dụng lượt",
  EXPIRED: "Gói hết hạn",
  STATUS_CHANGED: "Đổi trạng thái",
  BALANCE_IMPORTED: "Số dư ban đầu",
  TRANSFERRED: "Chuyển quyền sở hữu",
};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function delta(value: number, label: string) {
  if (!value) return null;
  return <span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold", value > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{value > 0 ? "+" : ""}{value} {label}</span>;
}

export function AdminPackageDashboard({ packages }: { packages: PackageOption[] }) {
  const [tab, setTab] = useState<DashboardTab>("SUMMARY");
  const [query, setQuery] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<PackageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (query.trim()) params.set("query", query.trim());
      if (planId) params.set("planId", planId);
      if (status) params.set("status", status);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      try {
        const response = await fetch(`/api/admin-packages/analytics?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Không thể tải báo cáo gói.");
        setData(result as PackageAnalytics);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Không thể tải báo cáo gói.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [page, paymentStatus, planId, query, refreshKey, status]);

  const metrics = useMemo(() => data ? [
    { label: "Doanh thu đã nhận", value: formatMoney(data.summary.confirmedRevenue), note: data.summary.reconciliationDifference === 0 ? "Đã khớp sổ tài chính" : `Lệch ${formatMoney(data.summary.reconciliationDifference)}`, icon: CircleDollarSign, tone: data.summary.reconciliationDifference === 0 ? "green" : "red" },
    { label: "Thẻ đang hoạt động", value: data.summary.activeCards.toLocaleString("vi-VN"), note: `${data.summary.owners} người sở hữu`, icon: UsersRound, tone: "green" },
    { label: "Lượt còn dùng được", value: data.summary.availableSessions.toLocaleString("vi-VN"), note: `${data.summary.reservedSessions} lượt đang giữ`, icon: TicketCheck, tone: "gold" },
    { label: "Lượt đã sử dụng", value: data.summary.usedSessions.toLocaleString("vi-VN"), note: `Trên ${data.summary.totalSessions} lượt đã bán`, icon: CheckCircle2, tone: "red" },
    { label: "Chờ đối soát", value: data.summary.pendingPayments.toLocaleString("vi-VN"), note: "Đơn chưa kích hoạt", icon: Clock3, tone: "gold" },
    { label: "Có người giới thiệu", value: data.summary.referredCards.toLocaleString("vi-VN"), note: `Trên ${data.summary.cards} thẻ`, icon: BarChart3, tone: "green" },
  ] : [], [data]);

  function resetPage(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-[#d2ad5d]/55 bg-white shadow-sm">
      <div className="border-b border-[#eee2da] p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#4c191b]">Sức khỏe Gói dài hạn</h2>
            <p className="mt-0.5 text-[10px] text-[#826f66]">Dòng tiền lấy từ giao dịch đã đối soát; số lượt lấy từ sổ biến động gói.</p>
          </div>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#dfd1c8] px-3 text-[10px] font-semibold text-[#76551d]"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#826f66]" /><input value={query} onChange={(event) => resetPage(() => setQuery(event.target.value))} className="h-10 w-full rounded-xl border border-[#e3d6ce] bg-[#fffdfa] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" placeholder="Tìm chủ thẻ, SĐT, gói, người giới thiệu, mã thanh toán..." /></label>
          <select value={planId} onChange={(event) => resetPage(() => setPlanId(event.target.value))} className="h-10 rounded-xl border border-[#e3d6ce] bg-[#fffdfa] px-3 text-xs outline-none"><option value="">Tất cả gói</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value))} className="min-w-0 rounded-xl border border-[#e3d6ce] bg-[#fffdfa] px-2 text-[10px] outline-none"><option value="">Mọi trạng thái gói</option>{Object.entries(PACKAGE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={paymentStatus} onChange={(event) => resetPage(() => setPaymentStatus(event.target.value))} className="min-w-0 rounded-xl border border-[#e3d6ce] bg-[#fffdfa] px-2 text-[10px] outline-none"><option value="">Mọi thanh toán</option>{Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
      </div>

      {error ? <p role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      {!data && loading ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-[#826f66]"><Loader2 size={17} className="animate-spin" /> Đang tổng hợp sổ gói...</div> : null}
      {data ? <>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6 sm:p-4">
          {metrics.map((item) => <article key={item.label} className={cn("rounded-xl border p-3", item.tone === "green" ? "border-emerald-200 bg-emerald-50/60" : item.tone === "gold" ? "border-amber-200 bg-amber-50/60" : "border-rose-200 bg-rose-50/60")}><item.icon size={15} className={item.tone === "green" ? "text-emerald-700" : item.tone === "gold" ? "text-amber-700" : "text-rose-700"} /><p className="mt-2 text-[9px] text-[#826f66]">{item.label}</p><strong className="mt-0.5 block text-sm text-[#281b18]">{item.value}</strong><small className="mt-1 block text-[8px] text-[#826f66]">{item.note}</small></article>)}
        </div>

        <div className="flex gap-1 overflow-x-auto border-y border-[#eee2da] bg-[#faf6f2] p-1.5">
          {([{ value: "SUMMARY", label: "Theo từng gói", icon: BarChart3 }, { value: "PURCHASES", label: `Chủ thẻ & thanh toán (${data.pagination.total})`, icon: UsersRound }, { value: "LEDGER", label: "Sổ biến động", icon: History }] as const).map((item) => <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold", tab === item.value ? "bg-white text-[#c64b32] shadow-sm" : "text-[#826f66]")}><item.icon size={12} />{item.label}</button>)}
          <span className="ml-auto hidden self-center pr-2 text-[8px] text-[#9a8378] sm:block">Cập nhật {dateTime(data.generatedAt)}</span>
        </div>

        {tab === "SUMMARY" ? <div className="overflow-x-auto p-3 sm:p-4"><table className="w-full min-w-[760px] text-left text-[10px]"><thead className="text-[#826f66]"><tr><th className="pb-2 font-semibold">Gói</th><th className="pb-2 font-semibold">Thẻ / Chủ sở hữu</th><th className="pb-2 font-semibold">Đang hoạt động</th><th className="pb-2 font-semibold">Còn / Đang giữ / Đã dùng</th><th className="pb-2 text-right font-semibold">Doanh thu đã nhận</th></tr></thead><tbody>{data.perPlan.map((item) => <tr key={item.planId} className="border-t border-[#f0e4dc]"><td className="py-3 font-semibold text-[#4c191b]">{item.planName}</td><td className="py-3">{item.cards} / {item.owners}</td><td className="py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{item.activeCards}</span></td><td className="py-3">{item.availableSessions} / {item.reservedSessions} / {item.usedSessions}</td><td className="py-3 text-right font-semibold text-[#c64b32]">{formatMoney(item.confirmedRevenue)}</td></tr>)}</tbody></table>{!data.perPlan.length ? <p className="py-8 text-center text-xs text-[#826f66]">Chưa có dữ liệu phù hợp bộ lọc.</p> : null}</div> : null}

        {tab === "PURCHASES" ? <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-[10px]"><thead className="bg-[#fffdfa] text-[#826f66]"><tr><th className="px-3 py-2.5 font-semibold">Chủ thẻ</th><th className="px-3 py-2.5 font-semibold">Gói & số lượt</th><th className="px-3 py-2.5 font-semibold">Trạng thái</th><th className="px-3 py-2.5 font-semibold">Thanh toán</th><th className="px-3 py-2.5 font-semibold">Người giới thiệu</th><th className="px-3 py-2.5 font-semibold">Thời gian</th></tr></thead><tbody>{data.purchases.map((item) => { const used = Math.max(0, item.sessionsTotal - item.sessionsRemaining - item.sessionsReserved); const paid = item.paymentTransaction?.status === "CONFIRMED"; return <tr key={item.id} className="border-t border-[#f0e4dc] align-top"><td className="px-3 py-3"><strong className="block text-[#281b18]">{item.customer.fullName}</strong><span className="text-[#826f66]">{item.customer.phone}</span></td><td className="px-3 py-3"><strong className="block text-[#4c191b]">{item.planNameSnapshot ?? item.packagePlan.name}</strong><span className="text-[#826f66]">Còn {item.sessionsRemaining} · Giữ {item.sessionsReserved} · Dùng {used}</span><span className="mt-1 block text-[8px] text-[#9a8378]">{item._count.bookings} lịch · {item._count.ledgerEntries} dòng sổ</span></td><td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 font-semibold", item.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : item.status === "PAUSED" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{PACKAGE_STATUS_LABELS[item.status]}</span></td><td className="px-3 py-3"><strong className={cn("block", paid ? "text-emerald-700" : "text-amber-700")}>{item.paymentTransaction ? PAYMENT_STATUS_LABELS[item.paymentTransaction.status] : "Chưa có giao dịch"}</strong><span>{formatMoney(item.paymentTransaction?.amount ?? item.planPriceSnapshot ?? item.packagePlan.price)}</span><span className="block text-[8px] text-[#9a8378]">{item.paymentTransaction?.paymentCode ?? "—"}</span></td><td className="px-3 py-3"><strong className="block">{item.referrerCustomer?.fullName ?? item.referrerName ?? item.referrerInput ?? "Không nhập"}</strong><span className="text-[#826f66]">{item.referrerCustomer?.phone ?? item.referrerPhone ?? item.campaign?.code ?? "—"}</span></td><td className="px-3 py-3"><span className="block">Mua: {dateTime(item.createdAt)}</span><span className="block">Nhận tiền: {dateTime(item.paymentTransaction?.paidAt ?? null)}</span><span className="block text-[#826f66]">HSD: {dateTime(item.expiresAt)}</span></td></tr>; })}</tbody></table>{!data.purchases.length ? <p className="py-8 text-center text-xs text-[#826f66]">Chưa có thẻ phù hợp bộ lọc.</p> : null}<div className="flex items-center justify-between border-t border-[#eee2da] p-3 text-[10px]"><span>Trang {data.pagination.page}/{data.pagination.totalPages} · {data.pagination.total} thẻ</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div></div> : null}

        {tab === "LEDGER" ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-[10px]"><thead className="bg-[#fffdfa] text-[#826f66]"><tr><th className="px-3 py-2.5 font-semibold">Thời gian</th><th className="px-3 py-2.5 font-semibold">Nghiệp vụ</th><th className="px-3 py-2.5 font-semibold">Khách & gói</th><th className="px-3 py-2.5 font-semibold">Biến động</th><th className="px-3 py-2.5 font-semibold">Đối chiếu</th></tr></thead><tbody>{data.ledger.map((item) => <tr key={item.id} className="border-t border-[#f0e4dc] align-top"><td className="px-3 py-3 whitespace-nowrap">{dateTime(item.occurredAt)}</td><td className="px-3 py-3"><strong className="block text-[#4c191b]">{EVENT_LABELS[item.event] ?? item.event}</strong><span className="text-[#826f66]">{item.description}</span></td><td className="px-3 py-3"><strong className="block">{item.customer.fullName}</strong><span className="text-[#826f66]">{item.packagePlan.name}</span></td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{delta(item.availableDelta, "khả dụng")}{delta(item.reservedDelta, "đang giữ")}{delta(item.usedDelta, "đã dùng")}{item.amount ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{formatMoney(item.amount)}</span> : null}</div></td><td className="px-3 py-3"><span className="block">{item.bookingGroup?.referenceCode ?? item.booking?.bookingCode ?? item.paymentTransaction?.paymentCode ?? "—"}</span><span className="text-[8px] text-[#9a8378]">{item.paymentTransaction?.status ? `Thanh toán: ${item.paymentTransaction.status}` : ""}</span></td></tr>)}</tbody></table>{!data.ledger.length ? <p className="py-8 text-center text-xs text-[#826f66]">Chưa có biến động phù hợp bộ lọc.</p> : null}</div> : null}
      </> : null}
    </section>
  );
}
