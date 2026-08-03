"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Pencil, Plus, Save, Search, Settings2, ShieldCheck, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminSetting = {
  id: string;
  key: string;
  category: string;
  label: string;
  value: string;
  valueType: string;
  description: string | null;
  branchId: string | null;
  isActive: boolean;
  updatedAt: string;
};

type FormState = Omit<AdminSetting, "id" | "updatedAt">;

const CATEGORIES = [
  { value: "ALL", label: "Tất cả" },
  { value: "CHAT", label: "Trợ lý chat" },
  { value: "BOOKING", label: "Đặt lịch" },
  { value: "NOTIFICATION", label: "Thông báo" },
  { value: "FINANCE", label: "Tài chính" },
  { value: "OPERATIONS", label: "Vận hành" },
  { value: "CRM", label: "CRM" },
  { value: "SECURITY", label: "Bảo mật" },
  { value: "BUSINESS", label: "Tâm An Business" },
] as const;

const VALUE_TYPES = [
  ["TEXT", "Văn bản"], ["BOOLEAN", "Bật / tắt"], ["NUMBER", "Số"], ["PERCENT", "Phần trăm"],
  ["MINUTES", "Phút"], ["DAYS", "Ngày"], ["TIME", "Giờ"], ["DATETIME", "Ngày giờ"], ["JSON", "Dữ liệu cấu trúc"],
] as const;

const EMPTY_FORM: FormState = {
  key: "",
  category: "OPERATIONS",
  label: "",
  value: "",
  valueType: "TEXT",
  description: "",
  branchId: null,
  isActive: true,
};

function displayValue(setting: AdminSetting) {
  if (setting.valueType === "JSON") {
    try {
      const value = JSON.parse(setting.value) as unknown;
      return Array.isArray(value) ? `${value.length} cấu hình` : "Đã cấu hình";
    } catch {
      return "JSON lỗi";
    }
  }
  if (setting.valueType === "BOOLEAN") return setting.value === "true" ? "Đang bật" : "Đang tắt";
  if (setting.valueType === "PERCENT") return `${setting.value}%`;
  if (setting.valueType === "MINUTES") return `${setting.value} phút`;
  if (setting.valueType === "DAYS") return `${setting.value} ngày`;
  return setting.value;
}

export function AdminSettingsCenter({
  initialSettings,
  branches,
  role,
  activeBranchId,
}: {
  initialSettings: AdminSetting[];
  branches: { id: string; label: string }[];
  role: "OWNER" | "BRANCH_MANAGER";
  activeBranchId: string | null;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminSetting | "NEW" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<AdminSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assistant = settings.find((item) => item.key === "assistant.enabled" && (role === "OWNER" ? item.branchId === null : item.branchId === activeBranchId))
    ?? settings.find((item) => item.key === "assistant.enabled" && item.branchId === null);
  const filtered = useMemo(() => settings.filter((item) => {
    if (category !== "ALL" && item.category !== category) return false;
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    return !keyword || `${item.label} ${item.key} ${item.description ?? ""}`.toLocaleLowerCase("vi-VN").includes(keyword);
  }), [category, query, settings]);

  function canManage(setting: AdminSetting) {
    return role === "OWNER" || setting.branchId === activeBranchId;
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, branchId: role === "OWNER" ? null : activeBranchId });
    setEditing("NEW");
    setError("");
  }

  function openEdit(setting: AdminSetting) {
    setForm({ key: setting.key, category: setting.category, label: setting.label, value: setting.value, valueType: setting.valueType, description: setting.description, branchId: setting.branchId, isActive: setting.isActive });
    setEditing(setting);
    setError("");
  }

  async function save() {
    if (!form.key.trim() || !form.label.trim()) return setError("Vui lòng nhập tên hiển thị và khóa cấu hình.");
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "NEW";
      const response = await fetch(isNew ? "/api/admin-settings" : `/api/admin-settings/${(editing as AdminSetting).id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu cấu hình.");
      const setting = { ...data.setting, updatedAt: new Date(data.setting.updatedAt).toISOString() } as AdminSetting;
      setSettings((items) => isNew ? [setting, ...items] : items.map((item) => item.id === setting.id ? setting : item));
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin-settings/${deleting.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa cấu hình.");
      setSettings((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(setting: AdminSetting) {
    if (!canManage(setting)) return;
    const next = setting.value !== "true";
    const response = await fetch(`/api/admin-settings/${setting.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: String(next) }) });
    if (!response.ok) return setError("Không thể cập nhật trạng thái trợ lý.");
    const data = await response.json();
    setSettings((items) => items.map((item) => item.id === setting.id ? { ...item, ...data.setting, updatedAt: new Date(data.setting.updatedAt).toISOString() } : item));
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-5">
      <section className="rounded-2xl bg-gradient-to-br from-[#2b1815] via-[#56271b] to-[#93352d] p-4 text-center text-white shadow-lg sm:p-5">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#e7c878]"><Settings2 size={21} /></span>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Trung tâm quản trị cấu hình</h1>
        <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-white/75">Thiết lập vận hành được lưu trong CSDL, phân phạm vi theo hệ thống/cơ sở và ghi nhật ký mỗi lần thêm, sửa hoặc xóa.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center"><div><strong className="block text-lg">{settings.length}</strong><span className="text-[10px] text-white/65">Cấu hình</span></div><div><strong className="block text-lg">{settings.filter((item) => item.isActive).length}</strong><span className="text-[10px] text-white/65">Đang áp dụng</span></div><div><strong className="block text-lg">{new Set(settings.map((item) => item.category)).size}</strong><span className="text-[10px] text-white/65">Nhóm nghiệp vụ</span></div></div>
      </section>

      {assistant ? <section className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#d2ad5d]/60 bg-[#fffaf0] p-3.5 shadow-sm"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5c3a1e] text-[#e7c878]"><MessageCircle size={18} /></span><div className="min-w-0"><p className="text-sm font-semibold">Trợ lý chat khách hàng</p><p className="mt-0.5 text-[10px] leading-4 text-[#715943]">{assistant.description} {assistant.branchId ? "Áp dụng riêng tại cơ sở." : "Áp dụng toàn hệ thống."}</p></div></div><button type="button" role="switch" aria-checked={assistant.value === "true"} disabled={!canManage(assistant)} onClick={() => void toggle(assistant)} className={cn("relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50", assistant.value === "true" ? "bg-[#18815e]" : "bg-[#d8cdc6]")}><span className={cn("absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", assistant.value === "true" ? "translate-x-5" : "translate-x-0")} /></button></section> : null}

      <section className="mt-3 rounded-2xl border border-[#e7d6ca] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f7f2ee] px-3 py-2.5"><Search size={15} className="shrink-0 text-[#826f66]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm cấu hình…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><button type="button" onClick={openNew} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#c64b32] px-3 py-2.5 text-xs font-semibold text-white"><Plus size={14} /> Thêm</button></div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">{CATEGORIES.map((item) => <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold", category === item.value ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#68574f]")}>{item.label}</button>)}</div>
      </section>

      {error && !editing && !deleting ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      <section className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {filtered.map((setting) => <article key={setting.id} className={cn("rounded-2xl border bg-white p-3.5 shadow-sm", setting.isActive ? "border-[#e7d6ca]" : "border-dashed border-[#d8cdc6] opacity-65")}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-[#f8ebe5] px-2 py-0.5 text-[9px] font-semibold text-[#c64b32]">{CATEGORIES.find((item) => item.value === setting.category)?.label ?? setting.category}</span><span className="rounded-full bg-[#f4eeea] px-2 py-0.5 text-[9px] text-[#68574f]">{setting.branchId ? branches.find((item) => item.id === setting.branchId)?.label ?? "Cơ sở" : "Toàn hệ thống"}</span></div><h2 className="mt-2 text-sm font-semibold leading-5">{setting.label}</h2></div><span className="shrink-0 text-sm font-bold text-[#0b5d45]">{displayValue(setting)}</span></div><p className="mt-1.5 text-[11px] leading-4 text-[#68574f]">{setting.description || "Chưa có mô tả vận hành."}</p><div className="mt-3 flex items-center justify-between border-t border-[#eee0d6] pt-2.5"><code className="max-w-[58%] truncate text-[9px] text-[#826f66]">{setting.key}</code>{canManage(setting) ? <span className="flex gap-1"><button type="button" onClick={() => openEdit(setting)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7df] text-[#76551d]" aria-label={`Sửa ${setting.label}`}><Pencil size={13} /></button><button type="button" onClick={() => { setDeleting(setting); setError(""); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700" aria-label={`Xóa ${setting.label}`}><Trash2 size={13} /></button></span> : <span className="inline-flex items-center gap-1 text-[9px] text-[#826f66]"><ShieldCheck size={11} /> Chỉ Chủ hệ thống</span>}</div></article>)}
        {!filtered.length ? <div className="col-span-full rounded-2xl border border-dashed border-[#e7d6ca] bg-white p-10 text-center text-xs text-[#826f66]">Không có cấu hình phù hợp bộ lọc.</div> : null}
      </section>

      {editing ? <div className="fixed inset-0 z-[90] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"><section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c64b32]">Cấu hình vận hành</p><h2 className="mt-1 text-lg font-semibold">{editing === "NEW" ? "Thêm hạng mục" : "Sửa hạng mục"}</h2></div><button type="button" onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f2ee]" aria-label="Đóng"><X size={16} /></button></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="col-span-2 text-xs font-semibold">Tên hiển thị<input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm outline-none focus:border-[#c64b32]" /></label><label className="col-span-2 text-xs font-semibold">Khóa cấu hình<input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value.toLowerCase().replace(/\s+/g, ".") })} placeholder="operations.example" className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-mono text-xs outline-none focus:border-[#c64b32]" /></label><label className="text-xs font-semibold">Nhóm<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-xs">{CATEGORIES.filter((item) => item.value !== "ALL").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs font-semibold">Kiểu dữ liệu<select value={form.valueType} onChange={(event) => setForm({ ...form, valueType: event.target.value, value: event.target.value === "BOOLEAN" ? "true" : form.value })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-xs">{VALUE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="col-span-2 text-xs font-semibold">Giá trị{form.valueType === "BOOLEAN" ? <select value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm"><option value="true">Bật</option><option value="false">Tắt</option></select> : form.valueType === "JSON" ? <textarea value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} rows={8} spellCheck={false} className="mt-1.5 w-full resize-y rounded-xl border border-[#e7d6ca] px-3 py-2.5 font-mono text-[11px] leading-5 outline-none focus:border-[#c64b32]" /> : <input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm outline-none focus:border-[#c64b32]" />}</label>{role === "OWNER" ? <label className="col-span-2 text-xs font-semibold">Phạm vi<select value={form.branchId ?? ""} onChange={(event) => setForm({ ...form, branchId: event.target.value || null })} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm"><option value="">Toàn hệ thống</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label> : null}<label className="col-span-2 text-xs font-semibold">Mô tả<textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-[#e7d6ca] p-3 text-sm leading-5 outline-none focus:border-[#c64b32]" /></label><label className="col-span-2 flex items-center gap-2 rounded-xl bg-[#f7f2ee] p-3 text-xs font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-[#c64b32]" /> Áp dụng cấu hình này</label></div>{error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-full border border-[#e7d6ca] py-2.5 text-xs font-semibold">Hủy</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#c64b32] py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save size={14} />} Lưu cấu hình</button></div></section></div> : null}

      {deleting ? <div className="fixed inset-0 z-[95] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"><section className="w-full rounded-t-3xl bg-white p-5 text-center sm:max-w-sm sm:rounded-2xl"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-700"><Trash2 size={18} /></span><h2 className="mt-3 text-lg font-semibold">Xóa cấu hình?</h2><p className="mt-1 text-xs leading-5 text-[#68574f]">“{deleting.label}” sẽ ngừng áp dụng và thao tác được lưu trong nhật ký quản trị.</p>{error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setDeleting(null)} className="rounded-full border border-[#e7d6ca] py-2.5 text-xs font-semibold">Giữ lại</button><button type="button" disabled={saving} onClick={() => void remove()} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-red-700 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Trash2 size={13} /> Xóa</button></div></section></div> : null}
    </main>
  );
}
