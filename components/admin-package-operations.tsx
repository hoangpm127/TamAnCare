"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleOff,
  Clock3,
  Gift,
  Layers3,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { type PackageMutationInput } from "@/lib/offer-admin";
import { cn, formatMoney } from "@/lib/utils";
import { AdminPackageDashboard } from "@/components/admin-package-dashboard";

export type AdminPackageView = {
  id: string;
  name: string;
  description: string | null;
  serviceId: string | null;
  sessions: number;
  paidSessions: number;
  bonusSessions: number;
  validityDays: number;
  price: number;
  badge: string | null;
  isHighlighted: boolean;
  isActive: boolean;
  shareable: boolean;
  transferable: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { customerPacks: number };
};

type ServiceOption = { id: string; label: string; active: boolean };
type Filter = "ALL" | "ACTIVE" | "INACTIVE";

const EMPTY_PACKAGE: PackageMutationInput = {
  name: "",
  description: "",
  serviceId: null,
  paidSessions: 5,
  bonusSessions: 0,
  validityDays: 90,
  price: 0,
  badge: "",
  isHighlighted: false,
  isActive: true,
  shareable: false,
  transferable: false,
};

function numberValue(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toForm(plan: AdminPackageView): PackageMutationInput {
  return {
    name: plan.name,
    description: plan.description ?? "",
    serviceId: plan.serviceId,
    paidSessions: plan.paidSessions,
    bonusSessions: plan.bonusSessions,
    validityDays: plan.validityDays,
    price: plan.price,
    badge: plan.badge ?? "",
    isHighlighted: plan.isHighlighted,
    isActive: plan.isActive,
    shareable: plan.shareable,
    transferable: plan.transferable,
  };
}

function sortPackages(packages: AdminPackageView[]) {
  return [...packages].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.price - right.price || left.name.localeCompare(right.name, "vi"));
}

function PackageEditor({
  plan,
  services,
  onClose,
  onSaved,
}: {
  plan: AdminPackageView | null;
  services: ServiceOption[];
  onClose: () => void;
  onSaved: (plan: AdminPackageView) => void;
}) {
  const [form, setForm] = useState<PackageMutationInput>(() => plan ? toForm(plan) : EMPTY_PACKAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const totalSessions = form.paidSessions + form.bonusSessions;
  const pricePerSession = totalSessions ? Math.round(form.price / totalSessions) : 0;

  function update<K extends keyof PackageMutationInput>(key: K, value: PackageMutationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(plan ? `/api/admin-packages/${encodeURIComponent(plan.id)}` : "/api/admin-packages", {
        method: plan ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu gói.");
      onSaved(data.package as AdminPackageView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu gói.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]";
  const checkboxClass = "flex items-start gap-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 text-xs font-semibold";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <form onSubmit={submit} className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fffdfa] shadow-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#eadbcf] bg-[#fffdfa]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c64b32]">{plan ? "Chỉnh sửa gói" : "Gói dài hạn mới"}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{plan?.name ?? "Thêm gói vào danh mục"}</h2>
            <p className="mt-1 text-[10px] text-[#826f66]">Gói đang bán sẽ đồng bộ với trang ưu đãi và quy trình thanh toán của khách.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7e9df]" aria-label="Đóng"><X size={17} /></button>
        </header>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold sm:col-span-2">Tên gói
            <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} placeholder="Ví dụ: Chăm sóc Body 5 buổi" />
          </label>
          <label className="text-xs font-semibold sm:col-span-2">Mô tả cho khách hàng (không bắt buộc)
            <textarea maxLength={1200} rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} className={inputClass} placeholder="Lợi ích, đối tượng phù hợp hoặc lưu ý khi sử dụng gói..." />
          </label>
          <label className="text-xs font-semibold">Dịch vụ áp dụng
            <select value={form.serviceId ?? ""} onChange={(event) => update("serviceId", event.target.value || null)} className={inputClass}>
              <option value="">Linh hoạt cho mọi dịch vụ</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.label}{!service.active ? " · đang tạm ẩn" : ""}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Nhãn nổi bật (không bắt buộc)
            <input maxLength={120} value={form.badge} onChange={(event) => update("badge", event.target.value)} className={inputClass} placeholder="Mua 9 tặng 1" />
          </label>
          <label className="text-xs font-semibold">Số buổi khách mua
            <input required type="number" min={0} max={10_000} value={form.paidSessions} onChange={(event) => update("paidSessions", numberValue(event.target.value))} className={inputClass} />
          </label>
          <label className="text-xs font-semibold">Số buổi tặng thêm
            <input required type="number" min={0} max={10_000} value={form.bonusSessions} onChange={(event) => update("bonusSessions", numberValue(event.target.value))} className={inputClass} />
          </label>
          <label className="text-xs font-semibold">Hạn sử dụng (ngày)
            <input required type="number" min={1} max={3650} value={form.validityDays} onChange={(event) => update("validityDays", numberValue(event.target.value))} className={inputClass} />
          </label>
          <label className="text-xs font-semibold">Giá bán gói (đ)
            <input required inputMode="numeric" value={form.price || ""} onChange={(event) => update("price", numberValue(event.target.value))} className={inputClass} placeholder="2000000" />
          </label>

          <div className="rounded-2xl border border-[#d8b96f] bg-[#fff7df] p-3 sm:col-span-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <span className="text-[9px] text-[#826f66]">Tổng quyền lợi<strong className="mt-0.5 block text-sm text-[#5c3a1e]">{totalSessions} buổi</strong></span>
              <span className="text-[9px] text-[#826f66]">Giá mỗi buổi<strong className="mt-0.5 block text-sm text-[#5c3a1e]">{formatMoney(pricePerSession)}</strong></span>
              <span className="text-[9px] text-[#826f66]">Hiệu lực<strong className="mt-0.5 block text-sm text-[#5c3a1e]">{form.validityDays} ngày</strong></span>
            </div>
          </div>

          <label className={checkboxClass}><input type="checkbox" checked={form.shareable} onChange={(event) => update("shareable", event.target.checked)} className="mt-0.5" /><span>Dùng cho nhóm<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Chủ thẻ có thể đặt nhiều người trong cùng lịch.</span></span></label>
          <label className={checkboxClass}><input type="checkbox" checked={form.transferable} onChange={(event) => update("transferable", event.target.checked)} className="mt-0.5" /><span>Cho phép chuyển nhượng<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Có thể chuyển quyền sở hữu gói theo nghiệp vụ.</span></span></label>
          <label className={checkboxClass}><input type="checkbox" checked={form.isHighlighted} onChange={(event) => update("isHighlighted", event.target.checked)} className="mt-0.5" /><span>Gói nổi bật<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Tạo điểm nhấn trên trang ưu đãi.</span></span></label>
          <label className={checkboxClass}><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} className="mt-0.5" /><span>Đang bán<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Hiển thị để khách chọn và thanh toán.</span></span></label>
          {plan ? <p className="rounded-xl bg-[#f7f1ec] p-3 text-[10px] text-[#68574f] sm:col-span-2">Mã hệ thống: <strong>{plan.id}</strong>. Mã được giữ ổn định để không ảnh hưởng các thẻ đã bán.</p> : null}
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

export function AdminPackageOperations({ initialPackages, services }: { initialPackages: AdminPackageView[]; services: ServiceOption[] }) {
  const [packages, setPackages] = useState(() => sortPackages(initialPackages));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<AdminPackageView | "NEW" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const counts = useMemo(() => ({
    all: packages.length,
    active: packages.filter((item) => item.isActive).length,
    sold: packages.reduce((sum, item) => sum + item._count.customerPacks, 0),
  }), [packages]);
  const visible = useMemo(() => packages.filter((plan) => {
    const matchesQuery = `${plan.name} ${plan.description ?? ""} ${plan.badge ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
    const matchesFilter = filter === "ALL" || (filter === "ACTIVE" ? plan.isActive : !plan.isActive);
    return matchesQuery && matchesFilter;
  }), [filter, packages, query]);

  function saved(plan: AdminPackageView) {
    setPackages((current) => sortPackages(current.some((item) => item.id === plan.id) ? current.map((item) => item.id === plan.id ? plan : item) : [...current, plan]));
    setEditing(null);
    setError("");
  }

  async function remove(plan: AdminPackageView) {
    const message = plan._count.customerPacks
      ? `Gói đã bán cho ${plan._count.customerPacks} khách. Hệ thống sẽ ngừng bán và giữ nguyên quyền lợi của các thẻ hiện có. Tiếp tục?`
      : `Xóa gói “${plan.name}”? Thao tác này không thể hoàn tác.`;
    if (!window.confirm(message)) return;
    setBusyId(plan.id);
    setError("");
    try {
      const response = await fetch(`/api/admin-packages/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa gói.");
      if (data.package) saved(data.package as AdminPackageView);
      else setPackages((current) => current.filter((item) => item.id !== plan.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa gói.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#7f1d1d] to-[#c64b32] px-4 py-4 text-center text-white shadow-lg">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-[#f3d487]"><PackageOpen size={21} /></span>
        <h1 className="mt-2 text-lg font-semibold">Quản lý Gói dài hạn</h1>
        <p className="mx-auto mt-1 max-w-xl text-[10px] leading-4 text-white/75">Một nguồn dữ liệu dùng chung cho trang ưu đãi, mua gói, kích hoạt thẻ và trừ buổi.</p>
        <div className="mx-auto mt-3 flex max-w-sm justify-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{counts.all} gói</span>
          <span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 text-[#76551d]">{counts.active} đang bán</span>
          <span className="rounded-full bg-[#fff2cc] px-2.5 py-1 text-[#76551d]">{counts.sold} thẻ đã tạo</span>
        </div>
      </section>

      <AdminPackageDashboard packages={packages.map((item) => ({ id: item.id, name: item.name }))} />

      <section className="mt-3 rounded-2xl border border-[#d2ad5d]/55 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#826f66]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-[#e3d6ce] bg-[#fffdfa] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" placeholder="Tìm tên, mô tả hoặc nhãn gói..." /></label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f7f1ec] p-1 text-[9px] font-semibold">
            {([{ value: "ALL", label: "Tất cả" }, { value: "ACTIVE", label: "Đang bán" }, { value: "INACTIVE", label: "Tạm dừng" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-lg px-3 py-2", filter === item.value ? "bg-white text-[#c64b32] shadow-sm" : "text-[#826f66]")}>{item.label}</button>)}
          </div>
          <button type="button" onClick={() => setEditing("NEW")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#c64b32] px-4 text-xs font-semibold text-white"><Plus size={15} /> Thêm gói</button>
        </div>
        {error ? <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      </section>

      {visible.length ? <section className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((plan) => {
          const service = services.find((item) => item.id === plan.serviceId);
          const pricePerSession = plan.sessions ? Math.round(plan.price / plan.sessions) : 0;
          return <article key={plan.id} className={cn("rounded-2xl border bg-white p-3.5 shadow-sm", plan.isActive ? "border-[#d2ad5d]/60" : "border-[#dfd6d0] opacity-80")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#a85f29]">{plan.badge ?? "Gói dài hạn"}</p><h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{plan.name}</h2></div>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[8px] font-bold", plan.isActive ? "bg-[#f1e5dd] text-[#76551d]" : "bg-[#eee8e4] text-[#6f625b]")}>{plan.isActive ? "ĐANG BÁN" : "TẠM DỪNG"}</span>
            </div>
            <p className="mt-2 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#68574f]">{plan.description || `Áp dụng cho ${service?.label ?? "các dịch vụ phù hợp"}.`}</p>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#fdf8f3] p-2.5 text-center">
              <span className="text-[9px] text-[#826f66]"><Layers3 size={11} className="mr-1 inline" />Số buổi<strong className="mt-0.5 block text-[11px] text-[#281b18]">{plan.bonusSessions ? `${plan.paidSessions}+${plan.bonusSessions}` : plan.sessions}</strong></span>
              <span className="text-[9px] text-[#826f66]"><Clock3 size={11} className="mr-1 inline" />Hiệu lực<strong className="mt-0.5 block text-[11px] text-[#281b18]">{plan.validityDays} ngày</strong></span>
              <span className="text-[9px] text-[#826f66]"><UsersRound size={11} className="mr-1 inline" />Đã bán<strong className="mt-0.5 block text-[11px] text-[#281b18]">{plan._count.customerPacks}</strong></span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2"><span><strong className="block text-sm text-[#c64b32]">{formatMoney(plan.price)}</strong><small className="text-[9px] text-[#826f66]">~{formatMoney(pricePerSession)}/buổi</small></span><span className="max-w-[55%] truncate text-right text-[9px] text-[#826f66]">{service?.label ?? "Mọi dịch vụ"}</span></div>
            <div className="mt-2 flex flex-wrap gap-1">{plan.isHighlighted ? <span className="rounded-full bg-[#fff2cc] px-2 py-1 text-[8px] font-semibold text-[#76551d]"><Gift size={9} className="mr-1 inline" />Nổi bật</span> : null}{plan.shareable ? <span className="rounded-full bg-[#fbf2e7] px-2 py-1 text-[8px] font-semibold text-[#76551d]">Dùng cho nhóm</span> : null}{plan.transferable ? <span className="rounded-full bg-[#fbf2e7] px-2 py-1 text-[8px] font-semibold text-[#76551d]">Chuyển nhượng</span> : null}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f0e4dc] pt-3">
              <button type="button" onClick={() => setEditing(plan)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d9c5b8] py-2 text-[10px] font-semibold text-[#76551d]"><Pencil size={12} /> Chỉnh sửa</button>
              {plan.isActive || plan._count.customerPacks === 0 ? <button type="button" disabled={busyId === plan.id} onClick={() => void remove(plan)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f8ebe5] py-2 text-[10px] font-semibold text-[#b5332b] disabled:opacity-50">{busyId === plan.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {plan._count.customerPacks ? "Ngừng bán" : "Xóa"}</button> : <button type="button" onClick={() => setEditing(plan)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f1e5dd] py-2 text-[10px] font-semibold text-[#76551d]"><CheckCircle2 size={12} /> Mở bán lại</button>}
            </div>
          </article>;
        })}
      </section> : <div className="mt-3 rounded-2xl border border-dashed border-[#d8c7bb] bg-white p-10 text-center text-sm text-[#826f66]"><CircleOff size={26} className="mx-auto mb-2" />Không có gói phù hợp bộ lọc.</div>}

      {editing ? <PackageEditor plan={editing === "NEW" ? null : editing} services={services} onClose={() => setEditing(null)} onSaved={saved} /> : null}
    </main>
  );
}
