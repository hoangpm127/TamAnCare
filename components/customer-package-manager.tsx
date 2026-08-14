"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, Loader2, Pencil, Plus, Search, TicketCheck, UserRound, X } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type PlanOption = { id: string; name: string; price: number; sessions: number; serviceId: string | null; validityDays: number };
type ServiceOption = { id: string; label: string; active: boolean };
type BranchOption = { id: string; label: string };
type CustomerOption = { id: string; fullName: string; phone: string };
type PackageRecord = {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "PAUSED" | "USED_UP";
  sessionsTotal: number;
  sessionsRemaining: number;
  sessionsReserved: number;
  expiresAt: string;
  note: string | null;
  planNameSnapshot: string | null;
  serviceIdSnapshot: string | null;
  customer: CustomerOption;
  packagePlan: PlanOption;
  paymentTransaction: { amount: number; method: string; paidAt: string | null } | null;
  ledgerEntries: Array<{ id: string; event: string; description: string; availableDelta: number; reservedDelta: number; usedDelta: number; occurredAt: string; booking: { bookingCode: string } | null }>;
};

const STATUS_LABELS = { ACTIVE: "Đang dùng", EXPIRED: "Hết hạn", PAUSED: "Tạm dừng", USED_UP: "Đã dùng hết" } as const;

function dateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CustomerPackageManager({ plans, services, branches, role, defaultBranchId }: { plans: PlanOption[]; services: ServiceOption[]; branches: BranchOption[]; role: string; defaultBranchId: string | null }) {
  const [records, setRecords] = useState<PackageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<{ mode: "CREATE" | "EDIT" | "USE" | "HISTORY"; record?: PackageRecord } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (status) params.set("status", status);
      try {
        const response = await fetch(`/api/customer-packages?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải gói của khách.");
        setRecords(data.packages ?? []);
        setError("");
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải gói của khách.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, refreshKey, status]);

  const totals = useMemo(() => ({
    active: records.filter((item) => item.status === "ACTIVE").length,
    available: records.reduce((sum, item) => sum + item.sessionsRemaining, 0),
    reserved: records.reduce((sum, item) => sum + item.sessionsReserved, 0),
  }), [records]);

  async function pause(record: PackageRecord) {
    if (!window.confirm(`Tạm dừng ${record.planNameSnapshot ?? record.packagePlan.name} của ${record.customer.fullName}?`)) return;
    const response = await fetch(`/api/customer-packages/${encodeURIComponent(record.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Không thể tạm dừng gói.");
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="mx-auto max-w-7xl px-3 pt-3 sm:px-6 sm:pt-5 lg:px-10">
      <section className="overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#321c18] via-[#6d2721] to-[#a43a30] p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#e7c878]">Dùng thường xuyên tại quầy</p><h1 className="mt-1 text-lg font-semibold">Gói dài hạn của khách</h1><p className="mt-1 text-[11px] leading-5 text-white/70">Cấp gói, sửa lượt, ghi nhận sử dụng offline và xem sổ biến động tại một nơi.</p></div>
            <button type="button" onClick={() => setDialog({ mode: "CREATE" })} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e7c878] px-3 py-2 text-xs font-semibold text-[#3d1f12]"><Plus size={14} /> Cấp gói</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[9px]"><span className="rounded-xl bg-white/10 p-2">Đang dùng<strong className="mt-1 block text-sm text-white">{totals.active}</strong></span><span className="rounded-xl bg-white/10 p-2">Lượt khả dụng<strong className="mt-1 block text-sm text-white">{totals.available}</strong></span><span className="rounded-xl bg-white/10 p-2">Lượt đang giữ<strong className="mt-1 block text-sm text-white">{totals.reserved}</strong></span></div>
        </div>
        <div className="grid gap-2 border-b border-[#eee0d6] p-3 sm:grid-cols-[1fr_180px]">
          <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#826f66]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-[#e3d6ce] pl-9 pr-3 text-xs outline-none focus:border-[#c64b32]" placeholder="Tìm tên khách, số điện thoại hoặc tên gói..." /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-[#e3d6ce] bg-white px-3 text-xs"><option value="">Mọi trạng thái</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        {error ? <p className="m-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
        {loading ? <div className="flex items-center justify-center gap-2 p-8 text-xs text-[#826f66]"><Loader2 size={16} className="animate-spin" /> Đang đồng bộ dữ liệu gói...</div> : null}
        {!loading ? <div className="grid gap-2.5 p-3 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => {
            const used = Math.max(0, record.sessionsTotal - record.sessionsRemaining - record.sessionsReserved);
            return <article key={record.id} className="rounded-2xl border border-[#e7d6ca] bg-[#fffdfa] p-3.5">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{record.customer.fullName}</p><p className="mt-0.5 text-[10px] text-[#826f66]">{record.customer.phone}</p></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold", record.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : record.status === "PAUSED" ? "bg-amber-50 text-amber-700" : "bg-[#f1ece8] text-[#6f625b]")}>{STATUS_LABELS[record.status]}</span></div>
              <div className="mt-3 rounded-xl bg-[#fbf2e7] p-3"><p className="text-xs font-semibold text-[#5c3a1e]">{record.planNameSnapshot ?? record.packagePlan.name}</p><p className="mt-1 text-[10px] text-[#826f66]">HSD {new Date(record.expiresAt).toLocaleDateString("vi-VN")} · {record.paymentTransaction ? `Đã thu ${formatMoney(record.paymentTransaction.amount)}` : "Cấp nội bộ, không ghi doanh thu"}</p></div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center"><span className="rounded-lg border border-[#eee0d6] bg-white p-2 text-[9px] text-[#826f66]">Còn<strong className="mt-0.5 block text-sm text-[#76551d]">{record.sessionsRemaining}</strong></span><span className="rounded-lg border border-[#eee0d6] bg-white p-2 text-[9px] text-[#826f66]">Đang giữ<strong className="mt-0.5 block text-sm text-[#a85f29]">{record.sessionsReserved}</strong></span><span className="rounded-lg border border-[#eee0d6] bg-white p-2 text-[9px] text-[#826f66]">Đã dùng<strong className="mt-0.5 block text-sm">{used}</strong></span></div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button type="button" disabled={record.status !== "ACTIVE" || record.sessionsRemaining < 1} onClick={() => setDialog({ mode: "USE", record })} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#76551d] px-2 py-2 text-[10px] font-semibold text-white disabled:opacity-40"><TicketCheck size={12} /> Dùng tại quầy</button>
                <button type="button" onClick={() => setDialog({ mode: "EDIT", record })} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#d9c5b8] px-2 py-2 text-[10px] font-semibold text-[#76551d]"><Pencil size={12} /> Sửa gói</button>
                <button type="button" onClick={() => setDialog({ mode: "HISTORY", record })} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#d9c5b8] px-2 py-2 text-[10px] font-semibold"><History size={12} /> Xem sổ</button>
                <button type="button" disabled={record.status === "PAUSED" || record.sessionsReserved > 0} onClick={() => void pause(record)} className="rounded-xl bg-[#f8ebe5] px-2 py-2 text-[10px] font-semibold text-[#b5332b] disabled:opacity-40">Tạm dừng</button>
              </div>
            </article>;
          })}
          {records.length === 0 ? <p className="col-span-full rounded-xl border border-dashed border-[#d8c7bb] p-8 text-center text-xs text-[#826f66]">Không có gói nào phù hợp bộ lọc.</p> : null}
        </div> : null}
      </section>
      {dialog ? <PackageDialog dialog={dialog} plans={plans} services={services} branches={branches} role={role} defaultBranchId={defaultBranchId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); setRefreshKey((value) => value + 1); }} /> : null}
    </main>
  );
}

function PackageDialog({ dialog, plans, services, branches, role, defaultBranchId, onClose, onSaved }: { dialog: { mode: "CREATE" | "EDIT" | "USE" | "HISTORY"; record?: PackageRecord }; plans: PlanOption[]; services: ServiceOption[]; branches: BranchOption[]; role: string; defaultBranchId: string | null; onClose: () => void; onSaved: () => void }) {
  const record = dialog.record;
  const initialPlan = plans[0];
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const selectedPlan = plans.find((item) => item.id === planId) ?? initialPlan;
  const [remaining, setRemaining] = useState(record?.sessionsRemaining ?? initialPlan?.sessions ?? 1);
  const [expiresAt, setExpiresAt] = useState(record ? dateInput(record.expiresAt) : futureDate(initialPlan?.validityDays ?? 30));
  const [status, setStatus] = useState(record?.status ?? "ACTIVE");
  const [note, setNote] = useState(record?.note ?? "");
  const [amountPaid, setAmountPaid] = useState(initialPlan?.price ?? 0);
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const applicableServiceId = record?.serviceIdSnapshot ?? record?.packagePlan.serviceId ?? selectedPlan?.serviceId ?? null;
  const [serviceId, setServiceId] = useState(applicableServiceId ?? services.find((item) => item.active)?.id ?? "");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dialog.mode !== "CREATE" || customerQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/customers?query=${encodeURIComponent(customerQuery.trim())}&limit=20`, { cache: "no-store", signal: controller.signal })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => { if (response.ok) setCustomers(data.customers ?? []); })
        .catch(() => undefined);
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [customerQuery, dialog.mode]);

  function changePlan(nextId: string) {
    const plan = plans.find((item) => item.id === nextId);
    setPlanId(nextId);
    if (plan) { setRemaining(plan.sessions); setAmountPaid(plan.price); setExpiresAt(futureDate(plan.validityDays)); if (plan.serviceId) setServiceId(plan.serviceId); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (dialog.mode === "HISTORY") return;
    setBusy(true);
    setError("");
    try {
      const endpoint = dialog.mode === "CREATE" ? "/api/customer-packages" : dialog.mode === "EDIT" ? `/api/customer-packages/${record!.id}` : `/api/customer-packages/${record!.id}/use`;
      const body = dialog.mode === "CREATE"
        ? { customerId, packagePlanId: planId, branchId, sessionsRemaining: remaining, sessionsTotal: selectedPlan?.sessions, expiresAt: `${expiresAt}T23:59:59+07:00`, amountPaid, note }
        : dialog.mode === "EDIT"
          ? { sessionsRemaining: remaining, expiresAt: `${expiresAt}T23:59:59+07:00`, status, note }
          : { branchId, serviceId, count, note };
      const response = await fetch(endpoint, { method: dialog.mode === "EDIT" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu thay đổi.");
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu thay đổi.");
    } finally {
      setBusy(false);
    }
  }

  const title = dialog.mode === "CREATE" ? "Cấp Gói dài hạn tại quầy" : dialog.mode === "EDIT" ? "Chỉnh gói của khách" : dialog.mode === "USE" ? "Ghi nhận dùng gói tại quầy" : "Sổ biến động gói";
  return <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-5"><button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Đóng" /><form onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Gói dài hạn</p><h2 className="mt-1 text-lg font-semibold">{title}</h2>{record ? <p className="mt-1 text-[11px] text-[#826f66]">{record.customer.fullName} · {record.customer.phone}</p> : null}</div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7]"><X size={17} /></button></div>
    {dialog.mode === "HISTORY" ? <div className="mt-4 space-y-2">{record?.ledgerEntries.map((entry) => <div key={entry.id} className="rounded-xl border border-[#e7d6ca] p-3"><div className="flex justify-between gap-2"><strong className="text-xs">{entry.description}</strong><span className="shrink-0 text-[9px] text-[#826f66]">{new Date(entry.occurredAt).toLocaleString("vi-VN")}</span></div><p className="mt-1 text-[10px] text-[#76551d]">Khả dụng {entry.availableDelta >= 0 ? "+" : ""}{entry.availableDelta} · Giữ {entry.reservedDelta >= 0 ? "+" : ""}{entry.reservedDelta} · Đã dùng {entry.usedDelta >= 0 ? "+" : ""}{entry.usedDelta}{entry.booking ? ` · ${entry.booking.bookingCode}` : ""}</p></div>)}{!record?.ledgerEntries.length ? <p className="rounded-xl border border-dashed p-6 text-center text-xs text-[#826f66]">Chưa có biến động.</p> : null}</div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {dialog.mode === "CREATE" ? <><label className="text-xs font-semibold sm:col-span-2">Tìm khách<input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-normal" placeholder="Nhập tên hoặc số điện thoại" /></label><div className="max-h-36 space-y-1 overflow-y-auto sm:col-span-2">{customers.map((customer) => <button key={customer.id} type="button" onClick={() => setCustomerId(customer.id)} className={cn("flex w-full items-center gap-2 rounded-xl border p-2.5 text-left", customerId === customer.id ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca]")}><UserRound size={14} /><span className="text-xs"><strong>{customer.fullName}</strong><small className="ml-2 text-[#826f66]">{customer.phone}</small></span></button>)}</div><label className="text-xs font-semibold">Mẫu gói<select value={planId} onChange={(event) => changePlan(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 font-normal">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label className="text-xs font-semibold">Tiền đã thu<input type="number" min={0} value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-normal" /></label></> : null}
      {dialog.mode === "EDIT" || dialog.mode === "CREATE" ? <><label className="text-xs font-semibold">Lượt còn dùng được<input type="number" min={0} max={dialog.mode === "EDIT" ? record!.sessionsTotal - record!.sessionsReserved : selectedPlan?.sessions} value={remaining} onChange={(event) => setRemaining(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-normal" /></label><label className="text-xs font-semibold">Hạn sử dụng<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-normal" /></label>{dialog.mode === "EDIT" ? <label className="text-xs font-semibold sm:col-span-2">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as PackageRecord["status"])} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 font-normal">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}</> : null}
      {dialog.mode === "USE" ? <><label className="text-xs font-semibold">Dịch vụ<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 font-normal">{services.filter((service) => service.active && (!applicableServiceId || service.id === applicableServiceId)).map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}</select></label><label className="text-xs font-semibold">Số lượt<input type="number" min={1} max={record?.sessionsRemaining ?? 1} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-normal" /></label></> : null}
      {(role === "OWNER" && (dialog.mode === "CREATE" || dialog.mode === "USE")) ? <label className="text-xs font-semibold sm:col-span-2">Cơ sở<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 font-normal">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label> : null}
      <label className="text-xs font-semibold sm:col-span-2">Ghi chú<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] p-3 font-normal" /></label>{error ? <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">{error}</p> : null}
    </div>}
    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[#e7d6ca] py-2.5 text-xs font-semibold">Đóng</button>{dialog.mode !== "HISTORY" ? <button disabled={busy || (dialog.mode === "CREATE" && !customerId)} className="inline-flex items-center justify-center gap-1 rounded-full bg-[#76551d] py-2.5 text-xs font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : dialog.mode === "USE" ? <TicketCheck size={13} /> : <CheckCircle2 size={13} />} {dialog.mode === "USE" ? "Trừ lượt & hoàn tất" : "Lưu & đồng bộ"}</button> : null}</div></form></div>;
}
