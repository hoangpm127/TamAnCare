"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  CircleOff,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  TicketPercent,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import {
  DISCOUNT_TYPE_OPTIONS,
  discountTypeLabel,
  minuteToTime,
  timeToMinute,
  type VoucherMutationInput,
} from "@/lib/offer-admin";
import { cn, formatMoney } from "@/lib/utils";

export type AdminVoucherView = {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: "FIXED" | "PERCENT" | "GIFT_SERVICE";
  discountValue: number;
  minimumSpend: number;
  maximumDiscount: number | null;
  displayConstraint: string;
  accentColor: string;
  firstVisitOnly: boolean;
  requiresAccount: boolean;
  requiresVerifiedPhone: boolean;
  minimumServiceDurationMin: number | null;
  bookingStartMinuteMin: number | null;
  bookingStartMinuteMax: number | null;
  excludeWeekend: boolean;
  validWithinDaysAfterLastVisit: number | null;
  validAfterDaysAfterLastVisit: number | null;
  maxUsage: number | null;
  maxPerCustomer: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  campaignId: string | null;
  serviceId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { usages: number; bookings: number };
};

type Option = { id: string; label: string; active?: boolean };
type Filter = "ALL" | "ACTIVE" | "INACTIVE";
type VoucherForm = Omit<VoucherMutationInput, "startsAt" | "endsAt" | "bookingStartMinuteMin" | "bookingStartMinuteMax"> & {
  startsAt: string;
  endsAt: string;
  bookingStartTime: string;
  bookingEndTime: string;
};

const EMPTY_VOUCHER: VoucherForm = {
  code: "",
  name: "",
  description: "",
  discountType: "FIXED",
  discountValue: 0,
  minimumSpend: 0,
  maximumDiscount: null,
  displayConstraint: "",
  accentColor: "#9f1d20",
  firstVisitOnly: false,
  requiresAccount: false,
  requiresVerifiedPhone: false,
  minimumServiceDurationMin: null,
  bookingStartTime: "",
  bookingEndTime: "",
  excludeWeekend: false,
  validWithinDaysAfterLastVisit: null,
  validAfterDaysAfterLastVisit: null,
  maxUsage: null,
  maxPerCustomer: null,
  startsAt: "",
  endsAt: "",
  isActive: true,
  campaignId: null,
  serviceId: null,
};

function numberValue(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string) {
  return value === "" ? null : numberValue(value);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toForm(voucher: AdminVoucherView): VoucherForm {
  return {
    code: voucher.code,
    name: voucher.name,
    description: voucher.description,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    minimumSpend: voucher.minimumSpend,
    maximumDiscount: voucher.maximumDiscount,
    displayConstraint: voucher.displayConstraint,
    accentColor: voucher.accentColor,
    firstVisitOnly: voucher.firstVisitOnly,
    requiresAccount: voucher.requiresAccount,
    requiresVerifiedPhone: voucher.requiresVerifiedPhone,
    minimumServiceDurationMin: voucher.minimumServiceDurationMin,
    bookingStartTime: minuteToTime(voucher.bookingStartMinuteMin),
    bookingEndTime: minuteToTime(voucher.bookingStartMinuteMax),
    excludeWeekend: voucher.excludeWeekend,
    validWithinDaysAfterLastVisit: voucher.validWithinDaysAfterLastVisit,
    validAfterDaysAfterLastVisit: voucher.validAfterDaysAfterLastVisit,
    maxUsage: voucher.maxUsage,
    maxPerCustomer: voucher.maxPerCustomer,
    startsAt: toLocalInput(voucher.startsAt),
    endsAt: toLocalInput(voucher.endsAt),
    isActive: voucher.isActive,
    campaignId: voucher.campaignId,
    serviceId: voucher.serviceId,
  };
}

function sortVouchers(vouchers: AdminVoucherView[]) {
  return [...vouchers].sort((left, right) => Number(right.isActive) - Number(left.isActive) || right.createdAt.localeCompare(left.createdAt));
}

function discountLabel(voucher: AdminVoucherView) {
  if (voucher.discountType === "PERCENT") return `${voucher.discountValue}%`;
  if (voucher.discountType === "GIFT_SERVICE") return "Tặng dịch vụ";
  return formatMoney(voucher.discountValue);
}

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Không giới hạn";
}

function VoucherEditor({
  voucher,
  services,
  campaigns,
  onClose,
  onSaved,
}: {
  voucher: AdminVoucherView | null;
  services: Option[];
  campaigns: Option[];
  onClose: () => void;
  onSaved: (voucher: AdminVoucherView) => void;
}) {
  const [form, setForm] = useState<VoucherForm>(() => voucher ? toForm(voucher) : EMPTY_VOUCHER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isWelcomeVoucher = form.code.trim().toUpperCase() === "WELCOME150";

  function update<K extends keyof VoucherForm>(key: K, value: VoucherForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { bookingStartTime, bookingEndTime, startsAt, endsAt, ...base } = form;
      const payload: VoucherMutationInput = {
        ...base,
        code: base.code.trim().toUpperCase(),
        discountValue: base.discountType === "GIFT_SERVICE" ? 0 : base.discountValue,
        bookingStartMinuteMin: timeToMinute(bookingStartTime),
        bookingStartMinuteMax: timeToMinute(bookingEndTime),
        startsAt: toIso(startsAt),
        endsAt: isWelcomeVoucher ? null : toIso(endsAt),
      };
      const response = await fetch(voucher ? `/api/admin-vouchers/${encodeURIComponent(voucher.id)}` : "/api/admin-vouchers", {
        method: voucher ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu voucher.");
      onSaved(data.voucher as AdminVoucherView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu voucher.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]";
  const checkboxClass = "flex items-start gap-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 text-xs font-semibold";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <form onSubmit={submit} className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-[#fffdfa] shadow-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#eadbcf] bg-[#fffdfa]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c64b32]">{voucher ? "Chỉnh sửa voucher" : "Voucher mới"}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{voucher?.code ?? "Thêm ưu đãi vào hệ thống"}</h2>
            <p className="mt-1 text-[10px] text-[#826f66]">Lưu xong, voucher đủ điều kiện sẽ xuất hiện ngay trên trang khách hàng.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7e9df]" aria-label="Đóng"><X size={17} /></button>
        </header>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold">Mã voucher
            <input required minLength={3} maxLength={40} disabled={Boolean(voucher)} value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} className={cn(inputClass, voucher && "bg-[#f1ece8] text-[#826f66]")} placeholder="WELCOME150" />
            {voucher ? <span className="mt-1 block text-[9px] font-normal text-[#826f66]">Mã được giữ ổn định để bảo toàn lịch sử sử dụng.</span> : null}
          </label>
          <label className="text-xs font-semibold">Tên hiển thị
            <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} placeholder="Ưu đãi chào mừng" />
          </label>
          <label className="text-xs font-semibold">Kiểu ưu đãi
            <select value={form.discountType} onChange={(event) => update("discountType", event.target.value as VoucherForm["discountType"])} className={inputClass}>
              {DISCOUNT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">{form.discountType === "PERCENT" ? "Mức giảm (%)" : form.discountType === "GIFT_SERVICE" ? "Giá trị (tự tính toàn bộ)" : "Số tiền giảm (đ)"}
            <input required disabled={form.discountType === "GIFT_SERVICE"} inputMode="numeric" value={form.discountType === "GIFT_SERVICE" ? 0 : form.discountValue || ""} onChange={(event) => update("discountValue", numberValue(event.target.value))} className={cn(inputClass, form.discountType === "GIFT_SERVICE" && "bg-[#f1ece8]")} placeholder="150000" />
          </label>
          <label className="text-xs font-semibold">Đơn tối thiểu (đ)
            <input inputMode="numeric" value={form.minimumSpend || ""} onChange={(event) => update("minimumSpend", numberValue(event.target.value))} className={inputClass} placeholder="0" />
          </label>
          <label className="text-xs font-semibold">Giảm tối đa (đ, không bắt buộc)
            <input inputMode="numeric" value={form.maximumDiscount ?? ""} onChange={(event) => update("maximumDiscount", nullableNumber(event.target.value))} className={inputClass} placeholder="Không giới hạn" />
          </label>
          <label className="text-xs font-semibold sm:col-span-2">Mô tả cho khách hàng
            <textarea required minLength={2} maxLength={1200} rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} className={inputClass} placeholder="Nội dung ngắn gọn về quyền lợi của voucher..." />
          </label>
          <label className="text-xs font-semibold sm:col-span-2">Điều kiện hiển thị ngắn
            <input maxLength={500} value={form.displayConstraint} onChange={(event) => update("displayConstraint", event.target.value)} className={inputClass} placeholder="Ví dụ: Khách mới · dịch vụ từ 60 phút" />
          </label>
          <label className="text-xs font-semibold">Dịch vụ áp dụng
            <select value={form.serviceId ?? ""} onChange={(event) => update("serviceId", event.target.value || null)} className={inputClass}>
              <option value="">Tất cả dịch vụ</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.label}{service.active === false ? " · đang tạm ẩn" : ""}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Chiến dịch liên kết
            <select value={form.campaignId ?? ""} onChange={(event) => update("campaignId", event.target.value || null)} className={inputClass}>
              <option value="">Không gắn chiến dịch</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.label}</option>)}
            </select>
          </label>

          <details className="rounded-2xl border border-[#e7d6ca] bg-[#fdf8f3] p-3 sm:col-span-2">
            <summary className="cursor-pointer text-xs font-semibold text-[#76551d]">Điều kiện nâng cao và giới hạn sử dụng</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Dịch vụ tối thiểu (phút)
                <input type="number" min={5} max={480} step={5} value={form.minimumServiceDurationMin ?? ""} onChange={(event) => update("minimumServiceDurationMin", nullableNumber(event.target.value))} className={inputClass} placeholder="Không giới hạn" />
              </label>
              <label className="text-xs font-semibold">Màu nhận diện
                <span className="mt-1.5 flex gap-2"><input type="color" value={form.accentColor} onChange={(event) => update("accentColor", event.target.value)} className="h-10 w-14 rounded-lg border border-[#dfd1c8] bg-white p-1" /><input value={form.accentColor} onChange={(event) => update("accentColor", event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#dfd1c8] bg-white px-3 text-sm font-normal" /></span>
              </label>
              <label className="text-xs font-semibold">Giờ bắt đầu áp dụng
                <input type="time" value={form.bookingStartTime} onChange={(event) => update("bookingStartTime", event.target.value)} className={inputClass} />
              </label>
              <label className="text-xs font-semibold">Giờ kết thúc áp dụng
                <input type="time" value={form.bookingEndTime} onChange={(event) => update("bookingEndTime", event.target.value)} className={inputClass} />
              </label>
              <label className="text-xs font-semibold">Bắt đầu sau lần ghé gần nhất (ngày)
                <input type="number" min={0} max={3650} value={form.validAfterDaysAfterLastVisit ?? ""} onChange={(event) => update("validAfterDaysAfterLastVisit", nullableNumber(event.target.value))} className={inputClass} placeholder="Không áp dụng" />
              </label>
              <label className="text-xs font-semibold">Dùng trong vòng sau lần ghé (ngày)
                <input type="number" min={1} max={3650} value={form.validWithinDaysAfterLastVisit ?? ""} onChange={(event) => update("validWithinDaysAfterLastVisit", nullableNumber(event.target.value))} className={inputClass} placeholder="Không giới hạn" />
              </label>
              <label className="text-xs font-semibold">Tổng số lượt
                <input type="number" min={1} max={10_000_000} value={form.maxUsage ?? ""} onChange={(event) => update("maxUsage", nullableNumber(event.target.value))} className={inputClass} placeholder="Không giới hạn" />
              </label>
              <label className="text-xs font-semibold">Số lượt mỗi khách
                <input type="number" min={1} max={1000} value={form.maxPerCustomer ?? ""} onChange={(event) => update("maxPerCustomer", nullableNumber(event.target.value))} className={inputClass} placeholder="Không giới hạn" />
              </label>
              <label className="text-xs font-semibold">Ngày bắt đầu
                <input type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} className={inputClass} />
              </label>
              <label className="text-xs font-semibold">Ngày kết thúc
                <input type="datetime-local" disabled={isWelcomeVoucher} value={isWelcomeVoucher ? "" : form.endsAt} onChange={(event) => update("endsAt", event.target.value)} className={cn(inputClass, isWelcomeVoucher && "bg-[#f1ece8]")} />
                {isWelcomeVoucher ? <span className="mt-1 block text-[9px] font-normal text-[#826f66]">WELCOME150 luôn hết hạn sau 7 ngày kể từ ngày từng khách nhận.</span> : null}
              </label>
              <label className={checkboxClass}><input type="checkbox" checked={form.firstVisitOnly} onChange={(event) => update("firstVisitOnly", event.target.checked)} className="mt-0.5" /><span>Chỉ khách lần đầu</span></label>
              <label className={checkboxClass}><input type="checkbox" checked={form.requiresAccount} onChange={(event) => update("requiresAccount", event.target.checked)} className="mt-0.5" /><span>Yêu cầu tài khoản</span></label>
              <label className={checkboxClass}><input type="checkbox" checked={form.requiresVerifiedPhone} onChange={(event) => update("requiresVerifiedPhone", event.target.checked)} className="mt-0.5" /><span>Yêu cầu số điện thoại đã xác nhận</span></label>
              <label className={checkboxClass}><input type="checkbox" checked={form.excludeWeekend} onChange={(event) => update("excludeWeekend", event.target.checked)} className="mt-0.5" /><span>Không áp dụng cuối tuần</span></label>
            </div>
          </details>

          <label className={cn(checkboxClass, "sm:col-span-2")}>
            <input type="checkbox" disabled={isWelcomeVoucher} checked={isWelcomeVoucher || form.isActive} onChange={(event) => update("isActive", event.target.checked)} className="mt-0.5" />
            <span>Đang phát hành<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">{isWelcomeVoucher ? "WELCOME150 là chính sách chào mừng cố định của tài khoản mới." : "Voucher chỉ hiển thị cho khách khi đang phát hành và còn trong thời gian áp dụng."}</span></span>
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 sm:col-span-2">{error}</p> : null}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#eadbcf] bg-white px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-[#dfd1c8] px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Hủy</button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#c64b32] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Lưu & đồng bộ</button>
        </footer>
      </form>
    </div>
  );
}

export function AdminVoucherOperations({
  initialVouchers,
  services,
  campaigns,
}: {
  initialVouchers: AdminVoucherView[];
  services: Option[];
  campaigns: Option[];
}) {
  const [vouchers, setVouchers] = useState(() => sortVouchers(initialVouchers));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<AdminVoucherView | "NEW" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const counts = useMemo(() => ({
    all: vouchers.length,
    active: vouchers.filter((item) => item.isActive).length,
    used: vouchers.reduce((sum, item) => sum + item._count.usages, 0),
  }), [vouchers]);
  const visible = useMemo(() => vouchers.filter((voucher) => {
    const matchesQuery = `${voucher.code} ${voucher.name} ${voucher.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
    const matchesFilter = filter === "ALL" || (filter === "ACTIVE" ? voucher.isActive : !voucher.isActive);
    return matchesQuery && matchesFilter;
  }), [filter, query, vouchers]);

  function saved(voucher: AdminVoucherView) {
    setVouchers((current) => sortVouchers(current.some((item) => item.id === voucher.id) ? current.map((item) => item.id === voucher.id ? voucher : item) : [...current, voucher]));
    setEditing(null);
    setError("");
  }

  async function remove(voucher: AdminVoucherView) {
    const linked = voucher._count.usages + voucher._count.bookings;
    const isSystemVoucher = ["WELCOME150", "AFF50", "RETURN100"].includes(voucher.code);
    const keepsHistory = linked > 0 || isSystemVoucher;
    const message = isSystemVoucher
      ? "Đây là voucher dùng trong quy trình tự động. Hệ thống sẽ ngừng phát hành nhưng vẫn giữ cấu hình để không làm gián đoạn dữ liệu. Tiếp tục?"
      : keepsHistory
        ? `Voucher đã có ${linked} lượt liên quan. Hệ thống sẽ ngừng phát hành và giữ nguyên lịch sử. Tiếp tục?`
      : `Xóa voucher ${voucher.code}? Thao tác này không thể hoàn tác.`;
    if (!window.confirm(message)) return;
    setBusyId(voucher.id);
    setError("");
    try {
      const response = await fetch(`/api/admin-vouchers/${encodeURIComponent(voucher.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa voucher.");
      if (data.voucher) saved(data.voucher as AdminVoucherView);
      else setVouchers((current) => current.filter((item) => item.id !== voucher.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa voucher.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#7f1d1d] to-[#c64b32] px-4 py-4 text-center text-white shadow-lg">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-[#f3d487]"><TicketPercent size={21} /></span>
        <h1 className="mt-2 text-lg font-semibold">Quản lý Voucher</h1>
        <p className="mx-auto mt-1 max-w-xl text-[10px] leading-4 text-white/75">Điều kiện, thời hạn và số lượt dùng được lưu chung cho trang ưu đãi, đặt lịch và thanh toán.</p>
        <div className="mx-auto mt-3 flex max-w-sm justify-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{counts.all} voucher</span>
          <span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 text-[#76551d]">{counts.active} đang phát hành</span>
          <span className="rounded-full bg-[#fff2cc] px-2.5 py-1 text-[#76551d]">{counts.used} lượt đã ghi nhận</span>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[#d2ad5d]/55 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#826f66]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-[#e3d6ce] bg-[#fffdfa] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" placeholder="Tìm mã, tên hoặc nội dung voucher..." /></label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f7f1ec] p-1 text-[9px] font-semibold">
            {([{ value: "ALL", label: "Tất cả" }, { value: "ACTIVE", label: "Đang chạy" }, { value: "INACTIVE", label: "Tạm dừng" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-lg px-3 py-2", filter === item.value ? "bg-white text-[#c64b32] shadow-sm" : "text-[#826f66]")}>{item.label}</button>)}
          </div>
          <button type="button" onClick={() => setEditing("NEW")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#c64b32] px-4 text-xs font-semibold text-white"><Plus size={15} /> Thêm voucher</button>
        </div>
        {error ? <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      </section>

      {visible.length ? <section className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((voucher) => {
          const linked = voucher._count.usages + voucher._count.bookings;
          const keepsHistory = linked > 0 || ["WELCOME150", "AFF50", "RETURN100"].includes(voucher.code);
          const isWelcomeVoucher = voucher.code === "WELCOME150";
          const service = services.find((item) => item.id === voucher.serviceId);
          const constraints = [voucher.firstVisitOnly ? "Khách lần đầu" : null, voucher.requiresAccount ? "Cần tài khoản" : null, voucher.excludeWeekend ? "Trừ cuối tuần" : null].filter(Boolean);
          return <article key={voucher.id} className={cn("overflow-hidden rounded-2xl border bg-white shadow-sm", voucher.isActive ? "border-[#d2ad5d]/60" : "border-[#dfd6d0] opacity-80")}>
            <div className="h-1.5" style={{ backgroundColor: voucher.accentColor }} />
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: voucher.accentColor }}>{voucher.code}</p><h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{voucher.name}</h2></div>
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-[8px] font-bold", voucher.isActive ? "bg-[#f1e5dd] text-[#76551d]" : "bg-[#eee8e4] text-[#6f625b]")}>{voucher.isActive ? "ĐANG PHÁT HÀNH" : "TẠM DỪNG"}</span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#68574f]">{voucher.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#fdf8f3] p-2.5">
                <span className="text-[9px] text-[#826f66]"><Tag size={11} className="mr-1 inline" />{discountTypeLabel(voucher.discountType)}<strong className="mt-0.5 block text-[12px] text-[#c64b32]">{discountLabel(voucher)}</strong></span>
                <span className="text-right text-[9px] text-[#826f66]"><UsersRound size={11} className="mr-1 inline" />Ghi nhận / giới hạn<strong className="mt-0.5 block text-[12px] text-[#281b18]">{voucher._count.usages}/{voucher.maxUsage ?? "∞"}</strong></span>
              </div>
              <div className="mt-2 space-y-1 text-[9px] leading-4 text-[#826f66]">
                <p><CalendarRange size={11} className="mr-1 inline" />{voucher.code === "WELCOME150" ? "7 ngày kể từ ngày khách nhận" : `${dateLabel(voucher.startsAt)} → ${dateLabel(voucher.endsAt)}`}</p>
                <p><Clock3 size={11} className="mr-1 inline" />{service ? service.label : "Tất cả dịch vụ"} · Đơn từ {formatMoney(voucher.minimumSpend)}</p>
              </div>
              {constraints.length ? <div className="mt-2 flex flex-wrap gap-1">{constraints.map((item) => <span key={item} className="rounded-full bg-[#fbf2e7] px-2 py-1 text-[8px] font-semibold text-[#76551d]">{item}</span>)}</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f0e4dc] pt-3">
                <button type="button" onClick={() => setEditing(voucher)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d9c5b8] py-2 text-[10px] font-semibold text-[#76551d]"><Pencil size={12} /> Chỉnh sửa</button>
                {isWelcomeVoucher ? <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#fff2cc] py-2 text-[10px] font-semibold text-[#76551d]"><CheckCircle2 size={12} /> Chính sách cố định</span> : voucher.isActive || !keepsHistory ? <button type="button" disabled={busyId === voucher.id} onClick={() => void remove(voucher)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f8ebe5] py-2 text-[10px] font-semibold text-[#b5332b] disabled:opacity-50">{busyId === voucher.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {keepsHistory ? "Ngừng phát hành" : "Xóa"}</button> : <button type="button" onClick={() => setEditing(voucher)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f1e5dd] py-2 text-[10px] font-semibold text-[#76551d]"><CheckCircle2 size={12} /> Mở lại</button>}
              </div>
            </div>
          </article>;
        })}
      </section> : <div className="mt-3 rounded-2xl border border-dashed border-[#d8c7bb] bg-white p-10 text-center text-sm text-[#826f66]"><CircleOff size={26} className="mx-auto mb-2" />Không có voucher phù hợp bộ lọc.</div>}

      {editing ? <VoucherEditor voucher={editing === "NEW" ? null : editing} services={services} campaigns={campaigns} onClose={() => setEditing(null)} onSaved={saved} /> : null}
    </main>
  );
}
