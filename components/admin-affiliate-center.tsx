"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BadgePercent,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Landmark,
  Loader2,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  ADMIN_AFFILIATE_PERIOD_OPTIONS,
  type AdminAffiliatePeriod,
  type AdminAffiliateReport,
} from "@/lib/admin-affiliate-types";
import { cn, formatMoney } from "@/lib/utils";

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function maskBankAccount(value: string | null) {
  if (!value) return "Chưa cập nhật";
  if (value.length <= 6) return value;
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

function invitedStatusLabel(value: "REGISTERED" | "BOOKED" | "COMPLETED") {
  if (value === "COMPLETED") return "Đã sử dụng dịch vụ";
  if (value === "BOOKED") return "Đã có lịch hẹn";
  return "Đã tạo tài khoản";
}

export function AdminAffiliateCenter() {
  const [period, setPeriod] = useState<AdminAffiliatePeriod>("30d");
  const [showPaid, setShowPaid] = useState(false);
  const [report, setReport] = useState<AdminAffiliateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
  const [transferReference, setTransferReference] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin-affiliates?period=${period}&paid=${showPaid ? "1" : "0"}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải đối soát Affiliate.");
        return payload as AdminAffiliateReport;
      })
      .then(setReport)
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Không thể tải đối soát Affiliate.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period, reloadToken, showPaid]);

  useEffect(() => {
    if (!selectedAffiliateId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedAffiliateId]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTimeline = useMemo(() => (report?.timeline ?? []).filter((item) => {
    if (!normalizedSearch) return true;
    return `${item.affiliateName} ${item.affiliatePhone} ${item.referredCustomerName} ${item.referredCustomerPhone} ${item.referenceCode} ${item.campaignCode}`.toLowerCase().includes(normalizedSearch);
  }), [normalizedSearch, report?.timeline]);
  const filteredAffiliates = useMemo(() => (report?.affiliates ?? []).filter((item) => {
    if (!normalizedSearch) return true;
    return `${item.name} ${item.phone} ${item.campaignCodes.join(" ")} ${item.invitedCustomers.map((customer) => `${customer.name} ${customer.phone}`).join(" ")}`.toLowerCase().includes(normalizedSearch);
  }), [normalizedSearch, report?.affiliates]);
  const selectedAffiliate = report?.affiliates.find((item) => item.id === selectedAffiliateId) ?? null;
  const selectedCommission = report?.timeline.find((item) => item.id === selectedCommissionId) ?? null;

  function closeDetail() {
    setSelectedAffiliateId(null);
    setSelectedCommissionId(null);
    setTransferReference("");
    setPayoutNote("");
    setCopied(false);
  }

  async function markPaid() {
    if (!selectedCommission || selectedCommission.status === "PAID") return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin-affiliates/${encodeURIComponent(selectedCommission.id)}/payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferReference, note: payoutNote }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chưa thể xác nhận chuyển khoản.");
      closeDetail();
      setReloadToken((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Chưa thể xác nhận chuyển khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAccount() {
    if (!selectedAffiliate?.bank.account) return;
    await navigator.clipboard.writeText(selectedAffiliate.bank.account);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#211514] via-[#4c281d] to-[#8b2b28] p-4 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#e7c878]/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#e7c878]"><BadgePercent size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e7c878]">Quản lý Affiliate</p>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Đối soát người giới thiệu</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/70">Theo dõi hoa hồng đã ghi nhận, hồ sơ nhận tiền và toàn bộ khách hàng được giới thiệu.</p>
          </div>
          <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] text-white/70 sm:inline-flex">Kỳ đối soát 15 ngày</span>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-[10px] text-white/60">Cần chuyển</span><strong className="mt-1 block truncate text-base text-[#ffe5a1] sm:text-lg">{formatMoney(report?.stats.pendingAmount ?? 0)}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-[10px] text-white/60">Quá hạn</span><strong className="mt-1 block truncate text-base text-[#ffc2b7] sm:text-lg">{formatMoney(report?.stats.overdueAmount ?? 0)}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-[10px] text-white/60">Đã chuyển</span><strong className="mt-1 block truncate text-base text-emerald-200 sm:text-lg">{formatMoney(report?.stats.paidAmount ?? 0)}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-[10px] text-white/60">Người giới thiệu</span><strong className="mt-1 block text-base sm:text-lg">{report?.stats.affiliateCount ?? 0} hồ sơ</strong></div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 shadow-sm sm:p-4">
        <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {ADMIN_AFFILIATE_PERIOD_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => { setLoading(true); setError(""); setPeriod(option.value); }} className={cn("shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition", period === option.value ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] bg-[#fdf8f3] text-[#68574f]")}>{option.label}</button>)}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-[#a48372]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm người giới thiệu, khách hoặc mã Bill" className="h-10 w-full rounded-xl border border-[#e7d6ca] bg-[#fdf8f3] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" /></label>
          <button type="button" role="switch" aria-checked={showPaid} onClick={() => { setLoading(true); setError(""); setShowPaid((value) => !value); }} className={cn("flex h-10 shrink-0 items-center justify-between gap-3 rounded-xl border px-3 text-xs font-semibold transition", showPaid ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-[#e7d6ca] bg-[#fff8ed] text-[#76551d]")}>
            <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition", showPaid ? "bg-emerald-500" : "bg-[#d8c9bd]")}><i className={cn("h-4 w-4 rounded-full bg-white shadow-sm transition", showPaid && "translate-x-4")} /></span>
            Đã thanh toán
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#826f66]">Đang xem: <strong className={showPaid ? "text-emerald-700" : "text-[#c64b32]"}>{showPaid ? "các khoản đã chuyển" : "các khoản chờ chuyển"}</strong> · {report?.range.label ?? "1 tháng qua"}</p>
      </section>

      {error ? <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error}</div> : null}

      <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Bút toán chờ chuyển", value: `${report?.stats.pendingCount ?? 0}`, note: formatMoney(report?.stats.pendingAmount ?? 0), icon: Clock3, tone: "bg-amber-50 text-amber-700" },
          { label: "Bút toán đã chuyển", value: `${report?.stats.paidCount ?? 0}`, note: formatMoney(report?.stats.paidAmount ?? 0), icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Khách được giới thiệu", value: `${report?.stats.referredCustomerCount ?? 0}`, note: "Hồ sơ đã quy nguồn", icon: UsersRound, tone: "bg-[#f8ebe5] text-[#c64b32]" },
          { label: "Hoa hồng phát sinh", value: formatMoney(report?.stats.earnedAmount ?? 0), note: report?.range.label ?? "", icon: WalletCards, tone: "bg-[#fbf2e7] text-[#76551d]" },
        ].map((item) => { const Icon = item.icon; return <div key={item.label} className="min-w-0 rounded-2xl border border-[#e7d6ca] bg-white p-3 shadow-sm"><div className="flex items-start gap-2"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", item.tone)}><Icon size={15} /></span><span className="min-w-0"><span className="block text-[9px] leading-3 text-[#826f66]">{item.label}</span><strong className="mt-1 block truncate text-sm">{item.value}</strong></span></div><p className="mt-2 truncate text-[9px] text-[#a48372]">{item.note}</p></div>; })}
      </section>

      <section className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-[#eee0d6] px-4 py-3"><div><h2 className="text-sm font-semibold">Dòng thời gian đối soát</h2><p className="mt-0.5 text-[10px] text-[#826f66]">{filteredTimeline.length} khoản · bấm để xem hồ sơ và chi tiết</p></div><ReceiptText size={18} className="text-[#c64b32]" /></header>
          <div className="divide-y divide-[#eee0d6]">
            {loading ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-[#826f66]"><Loader2 size={16} className="animate-spin text-[#c64b32]" /> Đang tổng hợp sổ cái...</div> : filteredTimeline.map((item) => (
              <button key={item.id} type="button" onClick={() => { setSelectedAffiliateId(item.affiliateId); setSelectedCommissionId(item.id); }} className="flex w-full min-w-0 items-start gap-3 p-3 text-left transition hover:bg-[#fdf8f3] sm:p-4">
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.status === "PAID" ? "bg-emerald-50 text-emerald-700" : item.isOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>{item.status === "PAID" ? <Check size={16} /> : <CalendarClock size={16} />}</span>
                <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-xs">{item.affiliateName}</strong><i className={cn("shrink-0 rounded-full px-2 py-0.5 text-[8px] not-italic font-semibold", item.status === "PAID" ? "bg-emerald-50 text-emerald-700" : item.isOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>{item.status === "PAID" ? "Đã chuyển" : item.isOverdue ? "Quá hạn" : "Chờ chuyển"}</i></span><span className="mt-1 block truncate text-[10px] text-[#826f66]">Giới thiệu {item.referredCustomerName} · {item.referenceCode}</span><span className="mt-1 block text-[9px] text-[#a48372]">Ghi nhận {DATE_TIME_FORMAT.format(new Date(item.occurredAt))} · hạn {DATE_FORMAT.format(new Date(item.dueAt))}</span></span>
                <span className="shrink-0 text-right"><strong className={cn("block text-xs", item.status === "PAID" ? "text-emerald-700" : "text-[#c64b32]")}>{formatMoney(item.amount)}</strong><ChevronRight size={15} className="ml-auto mt-2 text-[#b29383]" /></span>
              </button>
            ))}
            {!loading && filteredTimeline.length === 0 ? <div className="p-10 text-center"><BadgeCheck size={24} className="mx-auto text-[#d2ad5d]" /><p className="mt-2 text-xs font-semibold">Không có khoản phù hợp</p><p className="mt-1 text-[10px] text-[#826f66]">Hãy đổi kỳ, trạng thái hoặc nội dung tìm kiếm.</p></div> : null}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-[#eee0d6] px-4 py-3"><div><h2 className="text-sm font-semibold">Hồ sơ người giới thiệu</h2><p className="mt-0.5 text-[10px] text-[#826f66]">Tài khoản nhận tiền và khách đã mời</p></div><UsersRound size={18} className="text-[#76551d]" /></header>
          <div className="divide-y divide-[#eee0d6]">
            {filteredAffiliates.map((affiliate) => <button key={affiliate.id} type="button" onClick={() => { setSelectedAffiliateId(affiliate.id); setSelectedCommissionId(null); }} className="flex w-full min-w-0 items-center gap-3 p-3 text-left transition hover:bg-[#fdf8f3]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><UserRound size={16} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{affiliate.name}</strong><span className="mt-0.5 block truncate text-[9px] text-[#826f66]">{affiliate.phone} · {affiliate.campaignCodes.join(", ") || "Chưa có mã"}</span><span className="mt-1 block text-[9px] font-medium text-[#76551d]">{affiliate.invitedCustomers.length} khách · chờ {formatMoney(affiliate.periodPending)}</span></span><span className={cn("shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold", affiliate.bank.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{affiliate.bank.complete ? "Đủ hồ sơ" : "Thiếu TK"}</span></button>)}
            {!loading && filteredAffiliates.length === 0 ? <p className="p-8 text-center text-[10px] text-[#826f66]">Chưa có hồ sơ Affiliate phù hợp.</p> : null}
          </div>
        </div>
      </section>

      {selectedAffiliate ? <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
        <button type="button" onClick={closeDetail} className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Đóng hồ sơ Affiliate" />
        <section className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-[#fdf8f3] shadow-2xl sm:rounded-[2rem]">
          <header className="shrink-0 bg-gradient-to-br from-[#211514] via-[#4c281d] to-[#8b2b28] p-4 text-white sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#e7c878]"><BadgePercent size={21} /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#e7c878]">Hồ sơ Affiliate</p><h2 className="mt-1 truncate text-lg font-semibold">{selectedAffiliate.name}</h2><p className="mt-0.5 text-[10px] text-white/65">{selectedAffiliate.phone} · {selectedAffiliate.campaignCodes.join(", ") || "Chưa có mã giới thiệu"}</p></div><button type="button" onClick={closeDetail} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><span className="rounded-xl bg-white/10 p-2 text-[9px] text-white/60">Phát sinh<strong className="mt-1 block truncate text-[11px] text-white">{formatMoney(selectedAffiliate.periodEarnings)}</strong></span><span className="rounded-xl bg-amber-300/10 p-2 text-[9px] text-amber-100/65">Chờ chuyển<strong className="mt-1 block truncate text-[11px] text-amber-200">{formatMoney(selectedAffiliate.periodPending)}</strong></span><span className="rounded-xl bg-emerald-300/10 p-2 text-[9px] text-emerald-100/65">Đã chuyển<strong className="mt-1 block truncate text-[11px] text-emerald-200">{formatMoney(selectedAffiliate.periodPaid)}</strong></span></div></header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
            <section className={cn("rounded-2xl border p-3", selectedAffiliate.bank.complete ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50")}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#76551d]"><Landmark size={16} /></span><div><h3 className="text-xs font-semibold">Hồ sơ nhận tiền</h3><p className="text-[9px] text-[#826f66]">{selectedAffiliate.bank.complete ? "Đã đủ thông tin đối soát" : "Người giới thiệu chưa cập nhật đủ"}</p></div></div><span className={cn("rounded-full px-2 py-1 text-[8px] font-semibold", selectedAffiliate.bank.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{selectedAffiliate.bank.complete ? "Sẵn sàng" : "Cần bổ sung"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-white p-2.5"><span className="text-[#826f66]">Ngân hàng</span><strong className="mt-1 block">{selectedAffiliate.bank.name ?? "Chưa cập nhật"}</strong></div><div className="rounded-xl bg-white p-2.5"><span className="text-[#826f66]">Khu vực</span><strong className="mt-1 block">{selectedAffiliate.area ?? "Chưa cập nhật"}</strong></div><div className="col-span-2 rounded-xl bg-white p-2.5"><span className="text-[#826f66]">Tài khoản nhận</span><div className="mt-1 flex items-center justify-between gap-2"><strong>{selectedAffiliate.bank.holder ?? "Chưa cập nhật"} · {maskBankAccount(selectedAffiliate.bank.account)}</strong>{selectedAffiliate.bank.account ? <button type="button" onClick={() => void copyAccount()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]" aria-label="Sao chép số tài khoản">{copied ? <Check size={13} /> : <Copy size={13} />}</button> : null}</div></div></div></section>

            {selectedCommission ? <section className="rounded-2xl border border-[#e7d6ca] bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#c64b32]">Khoản hoa hồng đang xem</p><h3 className="mt-1 text-sm font-semibold">{selectedCommission.referenceCode}</h3><p className="mt-1 text-[10px] leading-4 text-[#826f66]">{selectedCommission.serviceLabel} · khách {selectedCommission.referredCustomerName}</p></div><strong className="shrink-0 text-sm text-[#c64b32]">{formatMoney(selectedCommission.amount)}</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-[#fdf8f3] p-2.5"><span className="text-[#826f66]">Ngày ghi nhận</span><strong className="mt-1 block">{DATE_FORMAT.format(new Date(selectedCommission.occurredAt))}</strong></div><div className="rounded-xl bg-[#fdf8f3] p-2.5"><span className="text-[#826f66]">Hạn đối soát</span><strong className={cn("mt-1 block", selectedCommission.isOverdue && "text-red-600")}>{DATE_FORMAT.format(new Date(selectedCommission.dueAt))}</strong></div></div>{selectedCommission.status === "PENDING" ? <div className="mt-3 space-y-2 border-t border-[#eee0d6] pt-3"><label className="block text-[10px] font-semibold text-[#68574f]">Mã giao dịch ngân hàng <span className="font-normal text-[#9a8378]">(không bắt buộc)</span><input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} maxLength={100} placeholder="Ví dụ: FT260812123456" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7d6ca] bg-[#fdf8f3] px-3 text-xs outline-none focus:border-[#c64b32]" /></label><label className="block text-[10px] font-semibold text-[#68574f]">Ghi chú <span className="font-normal text-[#9a8378]">(không bắt buộc)</span><textarea value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} maxLength={300} rows={2} placeholder="Nội dung cần lưu cùng lần đối soát" className="mt-1.5 w-full resize-none rounded-xl border border-[#e7d6ca] bg-[#fdf8f3] px-3 py-2.5 text-xs outline-none focus:border-[#c64b32]" /></label><div className="rounded-xl bg-[#fff7df] p-2.5 text-[10px] leading-4 text-[#76551d]"><ShieldCheck size={13} className="mr-1 inline" /> Khi xác nhận, hệ thống lưu người thao tác, thời gian và ảnh chụp thông tin tài khoản nhận vào sổ đối soát.</div><button type="button" onClick={() => void markPaid()} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c64b32] px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-[#c64b32]/15 disabled:opacity-60">{submitting ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />} Xác nhận đã chuyển khoản</button></div> : <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800"><CheckCircle2 size={14} className="mr-1 inline" /> Đã chuyển lúc {selectedCommission.paidAt ? DATE_TIME_FORMAT.format(new Date(selectedCommission.paidAt)) : "đã đối soát"}{selectedCommission.paidByName ? ` bởi ${selectedCommission.paidByName}` : ""}{selectedCommission.transferReference ? ` · Mã ${selectedCommission.transferReference}` : ""}.</div>}</section> : null}

            <section className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white"><header className="flex items-center justify-between gap-3 border-b border-[#eee0d6] px-3 py-2.5"><div><h3 className="text-xs font-semibold">Khách hàng đã giới thiệu</h3><p className="mt-0.5 text-[9px] text-[#826f66]">{selectedAffiliate.invitedCustomers.length} hồ sơ được quy nguồn</p></div><UsersRound size={16} className="text-[#c64b32]" /></header><div className="divide-y divide-[#eee0d6]">{selectedAffiliate.invitedCustomers.map((customer) => <div key={customer.id} className="flex items-start gap-3 p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><UserRound size={14} /></span><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><strong className="truncate text-[11px]">{customer.name}</strong><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold", customer.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : customer.status === "BOOKED" ? "bg-amber-50 text-amber-700" : "bg-[#f4eeea] text-[#68574f]")}>{invitedStatusLabel(customer.status)}</span></div><p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#826f66]"><Phone size={10} /> {customer.phone}</p><p className="mt-1 text-[9px] text-[#a48372]">Tham gia {DATE_FORMAT.format(new Date(customer.joinedAt))} · {customer.bookingCount} lịch · {customer.completedCount} hoàn tất</p></div><strong className="shrink-0 text-[10px] text-[#76551d]">{formatMoney(customer.completedRevenue)}</strong></div>)}{selectedAffiliate.invitedCustomers.length === 0 ? <p className="p-8 text-center text-[10px] text-[#826f66]">Chưa có khách nào hoàn tất quy nguồn cho hồ sơ này.</p> : null}</div></section>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
