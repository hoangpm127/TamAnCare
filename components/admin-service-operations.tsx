"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleOff, Clock3, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useAdminSession } from "@/components/admin-session-provider";
import { SERVICE_CATEGORY_OPTIONS, serviceCategoryLabel, type ServiceMutationInput } from "@/lib/service-admin";
import { cn, formatMoney } from "@/lib/utils";

export type AdminServiceView = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  durationMin: number;
  basePrice: number;
  therapistFee: number;
  suggestedTip: number;
  imageUrl: string | null;
  isActive: boolean;
  isOnline: boolean;
  sortOrder: number;
  updatedAt: string;
  _count: { bookings: number; packagePlans: number; therapists: number; vouchers: number };
};

type Filter = "ALL" | "ONLINE" | "HIDDEN";

const EMPTY_SERVICE: ServiceMutationInput = {
  name: "",
  description: "",
  category: "BODY",
  durationMin: 60,
  basePrice: 0,
  therapistFee: 0,
  suggestedTip: 0,
  imageUrl: "",
  sortOrder: 0,
  isActive: true,
  isOnline: true,
};

function sortServices(services: AdminServiceView[]) {
  return [...services].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "vi"));
}

function numberValue(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ServiceEditor({
  service,
  onClose,
  onSaved,
}: {
  service: AdminServiceView | null;
  onClose: () => void;
  onSaved: (service: AdminServiceView) => void;
}) {
  const [form, setForm] = useState<ServiceMutationInput>(() => service ? {
    name: service.name,
    description: service.description,
    category: service.category as ServiceMutationInput["category"],
    durationMin: service.durationMin,
    basePrice: service.basePrice,
    therapistFee: service.therapistFee,
    suggestedTip: service.suggestedTip,
    imageUrl: service.imageUrl ?? "",
    sortOrder: service.sortOrder,
    isActive: service.isActive,
    isOnline: service.isOnline,
  } : EMPTY_SERVICE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const customerPrice = form.basePrice + form.therapistFee;

  function update<K extends keyof ServiceMutationInput>(key: K, value: ServiceMutationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(service ? `/api/admin-services/${encodeURIComponent(service.id)}` : "/api/admin-services", {
        method: service ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu dịch vụ.");
      onSaved(data.service as AdminServiceView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu dịch vụ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fffdfa] shadow-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#eadbcf] bg-[#fffdfa]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c64b32]">{service ? "Chỉnh sửa dịch vụ" : "Dịch vụ mới"}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{service?.name ?? "Thêm vào danh mục"}</h2>
            <p className="mt-1 text-[10px] text-[#826f66]">Dữ liệu sau khi lưu sẽ đồng bộ với trang đặt lịch của khách.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7e9df]" aria-label="Đóng"><X size={17} /></button>
        </header>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold sm:col-span-2">Tên dịch vụ
            <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="Ví dụ: Massage Body 90 phút" />
          </label>
          <label className="text-xs font-semibold">Nhóm dịch vụ
            <select value={form.category} onChange={(event) => update("category", event.target.value as ServiceMutationInput["category"])} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]">
              {SERVICE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Thứ tự hiển thị
            <input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => update("sortOrder", numberValue(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" />
          </label>
          <label className="text-xs font-semibold">Thời lượng (phút)
            <input required type="number" min={5} max={480} step={5} value={form.durationMin} onChange={(event) => update("durationMin", numberValue(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" />
          </label>
          <label className="text-xs font-semibold">Giá dịch vụ (đ)
            <input required inputMode="numeric" value={form.basePrice || ""} onChange={(event) => update("basePrice", numberValue(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="350000" />
          </label>
          <label className="text-xs font-semibold">Phụ phí KTV trong Bill (đ)
            <input inputMode="numeric" value={form.therapistFee || ""} onChange={(event) => update("therapistFee", numberValue(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="0" />
          </label>
          <label className="text-xs font-semibold">Tip gợi ý ngoài Bill (đ)
            <input inputMode="numeric" value={form.suggestedTip || ""} onChange={(event) => update("suggestedTip", numberValue(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="0" />
          </label>
          <div className="rounded-2xl border border-[#d8b96f] bg-[#fff7df] p-3 sm:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#82601f]">Giá khách thanh toán trước ưu đãi</p>
            <p className="mt-1 text-xl font-bold text-[#5c3a1e]">{formatMoney(customerPrice)}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#826f66]">Giá dịch vụ + phụ phí KTV. Tip chỉ là gợi ý, nằm ngoài Bill và ngoài GMV.</p>
          </div>
          <label className="text-xs font-semibold sm:col-span-2">Mô tả hiển thị cho khách
            <textarea required minLength={2} maxLength={1200} rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal leading-5 outline-none focus:border-[#c64b32]" placeholder="Mô tả ngắn gọn lợi ích và trải nghiệm của dịch vụ..." />
          </label>
          <label className="text-xs font-semibold sm:col-span-2">Đường dẫn ảnh (không bắt buộc)
            <input type="url" maxLength={500} value={form.imageUrl ?? ""} onChange={(event) => update("imageUrl", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="https://..." />
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 text-xs font-semibold">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked, isOnline: event.target.checked ? current.isOnline : false }))} className="mt-0.5" />
            <span>Đang hoạt động<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Cho phép dùng dịch vụ trong vận hành.</span></span>
          </label>
          <label className={cn("flex items-start gap-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 text-xs font-semibold", !form.isActive && "opacity-50")}>
            <input type="checkbox" checked={form.isOnline} disabled={!form.isActive} onChange={(event) => update("isOnline", event.target.checked)} className="mt-0.5" />
            <span>Nhận lịch online<span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">Hiển thị để khách đặt trên webapp.</span></span>
          </label>
          {service ? <p className="rounded-xl bg-[#f7f1ec] p-3 text-[10px] text-[#68574f] sm:col-span-2">Mã hệ thống: <strong>{service.slug}</strong>. Mã được giữ ổn định để không ảnh hưởng dữ liệu đã liên kết.</p> : null}
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

export function AdminServiceOperations({ initialServices }: { initialServices: AdminServiceView[] }) {
  const { session } = useAdminSession();
  const [services, setServices] = useState(() => sortServices(initialServices));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<AdminServiceView | "NEW" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const canManage = session?.role === "OWNER";
  const counts = useMemo(() => ({
    all: services.length,
    online: services.filter((item) => item.isActive && item.isOnline).length,
    hidden: services.filter((item) => !item.isActive || !item.isOnline).length,
  }), [services]);
  const visible = useMemo(() => services.filter((service) => {
    const matchesQuery = `${service.name} ${service.description} ${serviceCategoryLabel(service.category)}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
    const matchesFilter = filter === "ALL" || (filter === "ONLINE" ? service.isActive && service.isOnline : !service.isActive || !service.isOnline);
    return matchesQuery && matchesFilter;
  }), [filter, query, services]);

  function saved(service: AdminServiceView) {
    setServices((current) => sortServices(current.some((item) => item.id === service.id) ? current.map((item) => item.id === service.id ? service : item) : [...current, service]));
    setEditing(null);
    setError("");
  }

  async function deactivate(service: AdminServiceView) {
    const linked = service._count.bookings + service._count.packagePlans + service._count.therapists + service._count.vouchers;
    const message = linked
      ? `Dịch vụ đang có ${linked} liên kết. Hệ thống sẽ chỉ ngừng bán và giữ nguyên toàn bộ lịch sử. Tiếp tục?`
      : "Ngừng dịch vụ này trên trang đặt lịch? Bạn vẫn có thể mở lại bằng nút Chỉnh sửa.";
    if (!window.confirm(message)) return;
    setBusyId(service.id);
    setError("");
    try {
      const response = await fetch(`/api/admin-services/${encodeURIComponent(service.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể ngừng dịch vụ.");
      saved(data.service as AdminServiceView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ngừng dịch vụ.");
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;
  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#7f1d1d] to-[#c64b32] px-4 py-4 text-center text-white shadow-lg">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-[#f3d487]"><Sparkles size={21} /></span>
        <h1 className="mt-2 text-lg font-semibold">Danh mục Dịch vụ</h1>
        <p className="mx-auto mt-1 max-w-xl text-[10px] leading-4 text-white/75">Một nguồn dữ liệu dùng chung cho giá bán, đặt lịch, gói dài hạn và phân công KTV.</p>
        <div className="mx-auto mt-3 flex max-w-sm justify-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{counts.all} dịch vụ</span>
          <span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 text-[#76551d]">{counts.online} đang nhận lịch</span>
          <span className="rounded-full bg-[#ffe0de] px-2.5 py-1 text-[#9b2929]">{counts.hidden} tạm ẩn</span>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[#d2ad5d]/55 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#826f66]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-[#e3d6ce] bg-[#fffdfa] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" placeholder="Tìm tên hoặc mô tả dịch vụ..." />
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f7f1ec] p-1 text-[9px] font-semibold">
            {([{ value: "ALL", label: "Tất cả" }, { value: "ONLINE", label: "Đang bán" }, { value: "HIDDEN", label: "Tạm ẩn" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-lg px-3 py-2", filter === item.value ? "bg-white text-[#c64b32] shadow-sm" : "text-[#826f66]")}>{item.label}</button>)}
          </div>
          {canManage ? <button type="button" onClick={() => setEditing("NEW")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#c64b32] px-4 text-xs font-semibold text-white"><Plus size={15} /> Thêm dịch vụ</button> : null}
        </div>
        {!canManage ? <p className="mt-2 rounded-xl bg-[#fff7df] p-2.5 text-[10px] text-[#76551d]">Bạn đang xem danh mục dùng chung. Chỉ Admin toàn hệ thống được thêm, sửa hoặc ngừng dịch vụ.</p> : null}
        {error ? <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      </section>

      {visible.length ? <section className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((service) => {
          const linked = service._count.bookings + service._count.packagePlans + service._count.therapists + service._count.vouchers;
          const online = service.isActive && service.isOnline;
          return <article key={service.id} className={cn("rounded-2xl border bg-white p-3.5 shadow-sm", online ? "border-[#d2ad5d]/60" : "border-[#dfd6d0] opacity-80")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#a85f29]">{serviceCategoryLabel(service.category)}</p><h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{service.name}</h2></div>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[8px] font-bold", online ? "bg-[#f1e5dd] text-[#76551d]" : "bg-[#eee8e4] text-[#6f625b]")}>{online ? "ĐANG NHẬN LỊCH" : service.isActive ? "NGỪNG ONLINE" : "ĐÃ NGỪNG"}</span>
            </div>
            <p className="mt-2 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#68574f]">{service.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#fdf8f3] p-2.5">
              <span className="text-[9px] text-[#826f66]"><Clock3 size={11} className="mr-1 inline" />Thời lượng<strong className="mt-0.5 block text-[11px] text-[#281b18]">{service.durationMin} phút</strong></span>
              <span className="text-right text-[9px] text-[#826f66]">Giá khách trả<strong className="mt-0.5 block text-[11px] text-[#c64b32]">{formatMoney(service.basePrice + service.therapistFee)}</strong></span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#826f66]"><span>Thứ tự {service.sortOrder}</span><span>{linked} liên kết dữ liệu</span></div>
            {canManage ? <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f0e4dc] pt-3">
              <button type="button" onClick={() => setEditing(service)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d9c5b8] py-2 text-[10px] font-semibold text-[#76551d]"><Pencil size={12} /> Chỉnh sửa</button>
              {service.isActive ? <button type="button" disabled={busyId === service.id} onClick={() => void deactivate(service)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f8ebe5] py-2 text-[10px] font-semibold text-[#b5332b] disabled:opacity-50">{busyId === service.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Ngừng bán</button> : <button type="button" onClick={() => setEditing(service)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f1e5dd] py-2 text-[10px] font-semibold text-[#76551d]"><CheckCircle2 size={12} /> Mở lại</button>}
            </div> : null}
          </article>;
        })}
      </section> : <div className="mt-3 rounded-2xl border border-dashed border-[#d8c7bb] bg-white p-10 text-center text-sm text-[#826f66]"><CircleOff size={26} className="mx-auto mb-2" />Không có dịch vụ phù hợp bộ lọc.</div>}

      {editing ? <ServiceEditor service={editing === "NEW" ? null : editing} onClose={() => setEditing(null)} onSaved={saved} /> : null}
    </main>
  );
}
