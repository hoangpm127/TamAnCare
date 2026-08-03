"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BellRing,
  Building2,
  FileSearch,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCcw,
  Rocket,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { cn } from "@/lib/utils";

type OpportunityStatus = "SURVEYING" | "DUE_DILIGENCE" | "FUNDING" | "APPROVED" | "ON_HOLD" | "CLOSED";
type CheckStatus = "DONE" | "IN_PROGRESS" | "PENDING";

type Opportunity = {
  id: string;
  type: "NEW_BRANCH" | "ACQUISITION";
  name: string;
  area: string;
  status: OpportunityStatus;
  statusLabel: string;
  progressPercent: number;
  capitalNeed: number;
  expressedInterestCapital: number;
  minimumCommitment: number;
  targetReturnRange: string;
  expectedPaybackPeriod: string;
  expectedOpening: string;
  nextUpdate: string;
  aiAssessment: string;
  highlights: string[];
  checks: Array<{ id?: string; label: string; status: CheckStatus }>;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type EditorState = Omit<Opportunity, "id" | "publishedAt" | "updatedAt"> & { id?: string; notifyInvestors: boolean };

const emptyEditor: EditorState = {
  type: "NEW_BRANCH",
  name: "",
  area: "",
  status: "SURVEYING",
  statusLabel: "Khảo sát sơ bộ",
  progressPercent: 10,
  capitalNeed: 0,
  expressedInterestCapital: 0,
  minimumCommitment: 0,
  targetReturnRange: "",
  expectedPaybackPeriod: "",
  expectedOpening: "",
  nextUpdate: "",
  aiAssessment: "",
  highlights: [""],
  checks: [{ label: "", status: "PENDING" }],
  isPublished: false,
  notifyInvestors: false,
};

const statusOptions = [
  { value: "SURVEYING", label: "Đang khảo sát", description: "Thu thập dữ liệu địa điểm và nhu cầu thị trường." },
  { value: "DUE_DILIGENCE", label: "Đang thẩm định", description: "Rà soát pháp lý, tài sản và phương án tài chính." },
  { value: "FUNDING", label: "Đang xem xét vốn", description: "Hồ sơ đủ điều kiện tiếp nhận đăng ký quan tâm." },
  { value: "APPROVED", label: "Đã phê duyệt", description: "Phương án đã được Chủ Tâm An phê duyệt." },
  { value: "ON_HOLD", label: "Tạm dừng", description: "Chờ thêm căn cứ trước khi tiếp tục." },
  { value: "CLOSED", label: "Đã đóng hồ sơ", description: "Không tiếp tục nhận cập nhật hoặc quan tâm." },
] as const;

const checkOptions = [
  { value: "PENDING", label: "Chưa thực hiện" },
  { value: "IN_PROGRESS", label: "Đang thực hiện" },
  { value: "DONE", label: "Đã hoàn tất" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function compactMoney(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
  return money(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function toEditor(item: Opportunity): EditorState {
  return {
    ...item,
    checks: item.checks.map(({ label, status }) => ({ label, status })),
    notifyInvestors: false,
  };
}

export function AdminInvestmentOpportunities() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/investment-opportunities", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể tải hồ sơ đầu tư.");
      setItems(payload.opportunities as Opportunity[]);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể tải hồ sơ đầu tư." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const totals = useMemo(() => ({
    published: items.filter((item) => item.isPublished).length,
    capital: items.filter((item) => item.isPublished).reduce((sum, item) => sum + item.capitalNeed, 0),
    interest: items.filter((item) => item.isPublished).reduce((sum, item) => sum + item.expressedInterestCapital, 0),
  }), [items]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy("save");
    setMessage(null);
    const payload = {
      ...editor,
      highlights: editor.highlights.map((item) => item.trim()).filter(Boolean),
      checks: editor.checks.map((item) => ({ label: item.label.trim(), status: item.status })).filter((item) => item.label),
    };
    try {
      const response = await fetch(editor.id ? `/api/investment-opportunities/${editor.id}` : "/api/investment-opportunities", {
        method: editor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể lưu hồ sơ.");
      setMessage({ tone: "ok", text: editor.isPublished ? "Đã lưu hồ sơ và đồng bộ tới Trung tâm Nhà đầu tư." : "Đã lưu bản nháp cơ hội đầu tư." });
      setEditor(null);
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể lưu hồ sơ." });
    } finally {
      setBusy("");
    }
  }

  async function updatePublication(item: Opportunity, isPublished: boolean, notifyInvestors = false) {
    setBusy(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/investment-opportunities/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished, notifyInvestors }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật hồ sơ.");
      setMessage({ tone: "ok", text: notifyInvestors ? "Đã gửi bản tin cập nhật tới toàn bộ Nhà đầu tư." : isPublished ? "Đã công bố hồ sơ." : "Đã đưa hồ sơ về bản nháp." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể cập nhật hồ sơ." });
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#182637] via-[#173e55] to-[#276c75] p-4 text-white shadow-xl sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-white/15"><Rocket size={21} /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200">Chỉ Chủ Tâm An · dữ liệu thật</p><h1 className="mt-0.5 text-xl font-semibold">Hồ sơ cơ hội đầu tư</h1><p className="mt-1 max-w-2xl text-[11px] leading-4 text-white/70">Tạo, thẩm định và công bố cơ hội mới; tách biệt hoàn toàn với Cơ sở 1, Cơ sở 2 đang vận hành.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="Tải lại"><RefreshCcw size={15} className={loading ? "animate-spin" : ""} /></button>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Đang công bố<strong className="mt-0.5 block text-sm text-white">{totals.published}</strong></span>
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Nhu cầu vốn<strong className="mt-0.5 block whitespace-nowrap text-xs text-sky-100">{compactMoney(totals.capital)}</strong></span>
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Đã quan tâm<strong className="mt-0.5 block whitespace-nowrap text-xs text-emerald-200">{compactMoney(totals.interest)}</strong></span>
        </div>
      </section>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#d8b46a]/55 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf7fc] text-[#276c75]"><ShieldCheck size={17} /></span><span className="min-w-0"><strong className="block truncate text-xs">Pipeline có kiểm soát</strong><span className="block truncate text-[9px] text-[#8a7a72]">Mọi thay đổi được lưu nhật ký; chỉ hồ sơ công bố mới đến Nhà đầu tư.</span></span></div>
        <button type="button" onClick={() => setEditor({ ...emptyEditor, highlights: [""], checks: [{ label: "", status: "PENDING" }] })} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d13f1f] px-3 py-2.5 text-[10px] font-semibold text-white"><Plus size={14} /> Tạo hồ sơ</button>
      </div>

      {message ? <div role="status" className={cn("mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5", message.tone === "ok" ? "border-[#b8dfc9] bg-[#edf9f2] text-[#16784a]" : "border-[#efc6be] bg-[#fff2ef] text-[#d13f1f]")}>{message.text}</div> : null}

      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        {loading ? <div className="col-span-full flex min-h-44 items-center justify-center rounded-2xl border border-[#eadbd1] bg-white text-[#d13f1f]"><LoaderCircle className="animate-spin" /></div> : null}
        {!loading && items.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-[#d8b46a] bg-white p-10 text-center text-xs text-[#8a7a72]">Chưa có hồ sơ. Hãy tạo bản nháp đầu tiên và chỉ công bố sau khi đủ căn cứ.</div> : null}
        {items.map((item) => {
          const finishedChecks = item.checks.filter((check) => check.status === "DONE").length;
          return <article key={item.id} className="overflow-hidden rounded-2xl border border-[#d7e2e8] bg-white shadow-sm">
            <div className="bg-gradient-to-br from-[#eff8fb] to-[#f9fcfd] p-4">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173e55] text-sky-100">{item.type === "NEW_BRANCH" ? <Building2 size={18} /> : <FileSearch size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className={cn("rounded-full px-2 py-1 text-[8px] font-bold", item.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600")}>{item.isPublished ? "ĐANG CÔNG BỐ" : "BẢN NHÁP"}</span><span className="rounded-full bg-sky-100 px-2 py-1 text-[8px] font-semibold text-sky-800">{item.statusLabel} · {item.progressPercent}%</span></div><h2 className="mt-2 text-sm font-semibold">{item.name}</h2><p className="mt-0.5 text-[10px] text-[#6c7c84]">{item.area}</p></div></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#d9e8ee]"><div className="h-full rounded-full bg-gradient-to-r from-[#2f8191] to-[#d8aa3f]" style={{ width: `${item.progressPercent}%` }} /></div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><span className="rounded-xl bg-[#fffaf6] p-2 text-[8px] text-[#8a7a72]">Nhu cầu vốn<strong className="mt-1 block truncate text-[10px] text-[#191414]">{money(item.capitalNeed)}</strong></span><span className="rounded-xl bg-[#fffaf6] p-2 text-[8px] text-[#8a7a72]">Đã quan tâm<strong className="mt-1 block truncate text-[10px] text-[#16784a]">{money(item.expressedInterestCapital)}</strong></span><span className="rounded-xl bg-[#fffaf6] p-2 text-[8px] text-[#8a7a72]">Hồi vốn dự kiến<strong className="mt-1 block truncate text-[10px] text-[#276c75]">{item.expectedPaybackPeriod}</strong></span><span className="rounded-xl bg-[#fffaf6] p-2 text-[8px] text-[#8a7a72]">Thẩm định<strong className="mt-1 block text-[10px] text-[#191414]">{finishedChecks}/{item.checks.length}</strong></span></div>
              <p className="mt-3 line-clamp-2 text-[10px] leading-4 text-[#6b5d56]">{item.aiAssessment}</p>
              <div className="mt-3 flex items-center justify-between border-t border-[#eee3dc] pt-3"><span className="text-[8px] text-[#9b8d85]">Cập nhật {dateTime(item.updatedAt)}</span><div className="flex gap-1.5"><button type="button" onClick={() => setEditor(toEditor(item))} className="flex h-8 items-center gap-1 rounded-lg border border-[#d7e2e8] px-2.5 text-[9px] font-semibold text-[#276c75]"><PencilLine size={12} /> Sửa</button>{item.isPublished ? <><button type="button" disabled={Boolean(busy)} onClick={() => void updatePublication(item, true, true)} className="flex h-8 items-center gap-1 rounded-lg border border-[#b8dfc9] px-2.5 text-[9px] font-semibold text-[#16784a]"><BellRing size={12} /> Bản tin</button><button type="button" disabled={Boolean(busy)} onClick={() => void updatePublication(item, false)} className="h-8 rounded-lg border border-[#eadbd1] px-2.5 text-[9px] font-semibold text-[#7b665b]">Ẩn</button></> : <button type="button" disabled={Boolean(busy)} onClick={() => void updatePublication(item, true)} className="flex h-8 items-center gap-1 rounded-lg bg-[#173e55] px-2.5 text-[9px] font-semibold text-white"><Rocket size={12} /> Công bố</button>}</div></div>
            </div>
          </article>;
        })}
      </section>

      {editor ? <div className="fixed inset-0 z-[170] overflow-y-auto bg-[#160d0a]/70 p-2 backdrop-blur-sm sm:p-5">
        <form onSubmit={submit} className="mx-auto my-2 max-w-3xl overflow-hidden rounded-2xl bg-[#fffdfb] shadow-2xl sm:my-5">
          <header className="sticky top-0 z-10 flex items-start gap-3 bg-gradient-to-r from-[#1b2f42] to-[#276c75] p-4 text-white"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-200"><Rocket size={18} /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200">Hồ sơ có nhật ký kiểm soát</p><h2 className="text-base font-semibold">{editor.id ? "Cập nhật cơ hội đầu tư" : "Tạo cơ hội đầu tư"}</h2></div><button type="button" onClick={() => setEditor(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button></header>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Tên hồ sơ"><input required minLength={5} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="field" placeholder="Đề xuất mở mới · Khu vực" /></Field><Field label="Khu vực khảo sát"><input required minLength={5} value={editor.area} onChange={(event) => setEditor({ ...editor, area: event.target.value })} className="field" placeholder="Quận, thành phố" /></Field></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Loại cơ hội"><CompactSelect value={editor.type} onValueChange={(value) => setEditor({ ...editor, type: value as EditorState["type"] })} dialogTitle="Loại cơ hội đầu tư" options={[{ value: "NEW_BRANCH", label: "Mở cơ sở mới", description: "Khảo sát và xây dựng một cơ sở mới." }, { value: "ACQUISITION", label: "Thầu lại cơ sở", description: "Tiếp nhận tài sản hoặc hoạt động hiện hữu." }]} /></Field><Field label="Giai đoạn"><CompactSelect value={editor.status} onValueChange={(value) => setEditor({ ...editor, status: value as OpportunityStatus })} dialogTitle="Giai đoạn hồ sơ" options={statusOptions} /></Field></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_0.55fr]"><Field label="Nhãn trạng thái hiển thị"><input required value={editor.statusLabel} onChange={(event) => setEditor({ ...editor, statusLabel: event.target.value })} className="field" /></Field><Field label={`Tiến độ · ${editor.progressPercent}%`}><input type="range" min="0" max="100" value={editor.progressPercent} onChange={(event) => setEditor({ ...editor, progressPercent: Number(event.target.value) })} className="mt-3 w-full accent-[#d13f1f]" /></Field></div>
            <section className="overflow-hidden rounded-2xl border border-[#bdd9e2] bg-gradient-to-br from-[#f3fbfd] to-white">
              <div className="flex items-center gap-2 border-b border-[#d7e8ed] bg-[#eaf6f9] px-3 py-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#276c75] text-white"><Building2 size={15} /></span><div><h3 className="text-xs font-semibold text-[#173e55]">Phương án vốn & thời gian</h3><p className="text-[9px] text-[#64808b]">Các chỉ số chính được trình bày đồng bộ cho Nhà đầu tư.</p></div></div>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3"><MoneyField label="Tổng nhu cầu vốn" value={editor.capitalNeed} onChange={(value) => setEditor({ ...editor, capitalNeed: value })} /><MoneyField label="Vốn đang quan tâm" value={editor.expressedInterestCapital} onChange={(value) => setEditor({ ...editor, expressedInterestCapital: value })} /><MoneyField label="Mức tham gia tối thiểu" value={editor.minimumCommitment} onChange={(value) => setEditor({ ...editor, minimumCommitment: value })} /></div>
              <div className="grid gap-3 border-t border-[#e1eef1] p-3 sm:grid-cols-2"><Field label="Thời gian hồi vốn dự kiến"><input required value={editor.expectedPaybackPeriod} onChange={(event) => setEditor({ ...editor, expectedPaybackPeriod: event.target.value })} className="field text-center font-semibold" placeholder="Khoảng 30–36 tháng" /></Field><Field label="Mục tiêu tham chiếu"><input required value={editor.targetReturnRange} onChange={(event) => setEditor({ ...editor, targetReturnRange: event.target.value })} className="field text-center font-semibold" placeholder="20–25%/năm" /></Field><Field label="Mốc dự kiến"><input required value={editor.expectedOpening} onChange={(event) => setEditor({ ...editor, expectedOpening: event.target.value })} className="field" placeholder="Dự kiến Quý I/2027" /></Field><Field label="Lịch cập nhật tiếp"><input required value={editor.nextUpdate} onChange={(event) => setEditor({ ...editor, nextUpdate: event.target.value })} className="field" placeholder="Cập nhật trong 07 ngày" /></Field></div>
            </section>
            <Field label="Tóm tắt thẩm định"><textarea required minLength={10} maxLength={1500} rows={4} value={editor.aiAssessment} onChange={(event) => setEditor({ ...editor, aiAssessment: event.target.value })} className="field resize-none" placeholder="Các căn cứ, rủi ro cần xác minh và điều kiện trước khi nhận vốn…" /></Field>
            <ListEditor title="Điểm nổi bật" items={editor.highlights} onChange={(highlights) => setEditor({ ...editor, highlights })} />
            <section className="rounded-2xl border border-[#eadbd1] bg-white p-3"><div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold">Danh mục thẩm định</h3><p className="mt-0.5 text-[9px] text-[#8a7a72]">Hiển thị trực tiếp trong hồ sơ Nhà đầu tư.</p></div><button type="button" onClick={() => setEditor({ ...editor, checks: [...editor.checks, { label: "", status: "PENDING" }] })} className="flex items-center gap-1 rounded-lg bg-[#edf7fc] px-2.5 py-2 text-[9px] font-semibold text-[#276c75]"><Plus size={12} /> Thêm</button></div><div className="mt-3 space-y-2">{editor.checks.map((check, index) => <div key={index} className="grid grid-cols-[1fr_126px_32px] gap-1.5"><input required value={check.label} onChange={(event) => setEditor({ ...editor, checks: editor.checks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className="field" placeholder="Nội dung cần thẩm định" /><CompactSelect value={check.status} onValueChange={(value) => setEditor({ ...editor, checks: editor.checks.map((item, itemIndex) => itemIndex === index ? { ...item, status: value as CheckStatus } : item) })} dialogTitle="Trạng thái thẩm định" options={checkOptions} /><button type="button" disabled={editor.checks.length === 1} onClick={() => setEditor({ ...editor, checks: editor.checks.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-10 items-center justify-center rounded-xl border border-[#eadbd1] text-[#d13f1f] disabled:opacity-30"><Trash2 size={13} /></button></div>)}</div></section>
            <div className="rounded-2xl border border-[#d8b46a]/60 bg-[#fff8e8] p-3"><label className="flex cursor-pointer items-start gap-2.5"><input type="checkbox" checked={editor.isPublished} onChange={(event) => setEditor({ ...editor, isPublished: event.target.checked, notifyInvestors: event.target.checked ? editor.notifyInvestors : false })} className="mt-0.5 h-4 w-4 accent-[#d13f1f]" /><span><strong className="block text-xs">Công bố tại Trung tâm Nhà đầu tư</strong><span className="mt-0.5 block text-[9px] leading-4 text-[#806e65]">Bản nháp chỉ Chủ Tâm An nhìn thấy; hồ sơ công bố sẽ được đưa vào pipeline Nhà đầu tư.</span></span></label>{editor.id && editor.isPublished ? <label className="mt-2 flex cursor-pointer items-start gap-2.5 border-t border-[#ead9ad] pt-2"><input type="checkbox" checked={editor.notifyInvestors} onChange={(event) => setEditor({ ...editor, notifyInvestors: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#276c75]" /><span><strong className="block text-xs">Gửi bản tin cập nhật</strong><span className="mt-0.5 block text-[9px] leading-4 text-[#806e65]">Tạo một thông báo mới cho tất cả tài khoản Nhà đầu tư sau khi lưu.</span></span></label> : null}</div>
          </div>
          <footer className="sticky bottom-0 grid grid-cols-[0.7fr_1.3fr] gap-2 border-t border-[#eadbd1] bg-white/95 p-3 backdrop-blur"><button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-[#eadbd1] px-4 py-3 text-xs font-semibold text-[#665b55]">Hủy</button><button disabled={busy === "save"} className="flex items-center justify-center gap-2 rounded-xl bg-[#d13f1f] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy === "save" ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Lưu hồ sơ</button></footer>
        </form>
      </div> : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7c6256]">{label}<div className="mt-1.5 font-normal normal-case tracking-normal">{children}</div></label>;
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input required inputMode="numeric" value={value || ""} onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "")))} className="field text-center font-semibold" placeholder="0" /><span className="mt-1 block text-center text-[8px] text-[#16784a]">{money(value)}</span></Field>;
}

function ListEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  return <section className="rounded-2xl border border-[#eadbd1] bg-white p-3"><div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-0.5 text-[9px] text-[#8a7a72]">Từ 1 đến 8 nội dung ngắn, có căn cứ.</p></div><button type="button" disabled={items.length >= 8} onClick={() => onChange([...items, ""])} className="flex items-center gap-1 rounded-lg bg-[#fff2ef] px-2.5 py-2 text-[9px] font-semibold text-[#d13f1f] disabled:opacity-40"><Plus size={12} /> Thêm</button></div><div className="mt-3 space-y-2">{items.map((item, index) => <div key={index} className="grid grid-cols-[1fr_34px] gap-1.5"><input required value={item} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} className="field" placeholder="Điểm nổi bật có thể kiểm chứng" /><button type="button" disabled={items.length === 1} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="flex h-10 items-center justify-center rounded-xl border border-[#eadbd1] text-[#d13f1f] disabled:opacity-30"><Trash2 size={13} /></button></div>)}</div></section>;
}
