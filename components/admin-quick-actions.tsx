"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, CheckCircle2, ChevronDown, FileCheck2, Handshake, ImagePlus, Loader2, MapPin, Phone, Plus, ReceiptText, ScanLine, Sparkles, UserPlus, UserRound, X } from "lucide-react";
import { usePublicCatalog } from "@/lib/catalog-store";
import { branches as demoBranches } from "@/lib/demo-data";
import { useAdminSession } from "@/components/admin-session-provider";
import { formatMoney } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  "Cơ sở vật chất",
  "Khấu hao tài sản",
  "Lương nhân sự",
  "Thưởng & hoa hồng",
  "Mặt bằng",
  "Điện, nước & Internet",
  "Vật tư tiêu hao",
  "Marketing & bán hàng",
  "Bảo trì thiết bị",
  "Nền tảng & hệ thống",
  "Thuế, phí & hành chính",
  "Chi phí khác",
] as const;

const SYSTEM_ACCOUNTING_SCOPE = { id: "system", label: "Chi cho hệ thống" };

function suggestExpenseCategory(description: string) {
  const text = description.toLocaleLowerCase("vi");
  if (/thuê|mặt bằng|tiền nhà/.test(text)) return "Mặt bằng";
  if (/điện|nước|internet|wifi|điện thoại/.test(text)) return "Điện, nước & Internet";
  if (/lương|nhân sự|ktv|chấm công/.test(text)) return "Lương nhân sự";
  if (/thưởng|hoa hồng|bonus|tip/.test(text)) return "Thưởng & hoa hồng";
  if (/khấu hao|phân bổ tài sản/.test(text)) return "Khấu hao tài sản";
  if (/sửa|bảo trì|bảo dưỡng/.test(text)) return "Bảo trì thiết bị";
  if (/giường|ghế|máy|thiết bị|nội thất|biển hiệu/.test(text)) return "Cơ sở vật chất";
  if (/tinh dầu|khăn|ga|dầu gội|vật tư|tiêu hao/.test(text)) return "Vật tư tiêu hao";
  if (/quảng cáo|marketing|facebook|tiktok|voucher/.test(text)) return "Marketing & bán hàng";
  if (/phần mềm|hosting|tên miền|nền tảng|server/.test(text)) return "Nền tảng & hệ thống";
  if (/thuế|lệ phí|giấy phép|hành chính/.test(text)) return "Thuế, phí & hành chính";
  return "Chi phí khác";
}

function CompactPicker({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedLabel = options.find((item) => item.value === value)?.label ?? value;

  return (
    <div className="relative text-xs font-semibold">
      <span>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded((current) => !current)}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-left text-xs font-medium disabled:bg-[#fdf8f3] disabled:text-[#826f66]"
        aria-expanded={expanded}
      >
        <span className="truncate">{selectedLabel}</span><ChevronDown size={14} className="shrink-0 text-[#c64b32]" />
      </button>
      {expanded && !disabled ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-44 overflow-y-auto rounded-xl border border-[#e4d2c6] bg-white p-1.5 shadow-xl">
          {options.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => { onChange(item.value); setExpanded(false); }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-[11px] font-medium ${item.value === value ? "bg-[#fae9e4] text-[#c64b32]" : "text-[#51443e] hover:bg-[#fdf8f3]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminExpenseAction() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("AUTO");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState(session?.branchId ?? branches[0].id);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [billFileName, setBillFileName] = useState("");
  const [billEvidenceId, setBillEvidenceId] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "uploading" | "ready" | "manual">("idle");
  const [duplicateEvidence, setDuplicateEvidence] = useState(false);
  const [confirmDuplicateEvidence, setConfirmDuplicateEvidence] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const billInputRef = useRef<HTMLInputElement>(null);

  if (!session || !["OWNER", "BRANCH_MANAGER"].includes(session.role)) return null;
  const suggestedCategory = suggestExpenseCategory(description);
  const resolvedCategory = category === "AUTO" ? suggestedCategory : category;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/\D/g, ""));
    if (!numericAmount || !description.trim()) return;
    const branch = branchId === SYSTEM_ACCOUNTING_SCOPE.id
      ? SYSTEM_ACCOUNTING_SCOPE
      : branches.find((item) => item.id === branchId) ?? branches[0];
    setSaving(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          description: description.trim(),
          categoryLabel: resolvedCategory,
          branchId: branch.id,
          counterparty: counterparty.trim() || undefined,
          evidenceId: billEvidenceId || undefined,
          confirmDuplicateEvidence: duplicateEvidence ? confirmDuplicateEvidence : undefined,
          occurredAt: new Date(`${expenseDate}T12:00:00+07:00`).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể ghi nhận khoản chi.");
    setDescription("");
    setAmount("");
    setCounterparty("");
    setCategory("AUTO");
    setBillPreview(null);
    setBillFileName("");
    setBillEvidenceId("");
    setDuplicateEvidence(false);
    setConfirmDuplicateEvidence(false);
    setEvidenceMessage("");
    setAiStatus("idle");
    setOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể ghi nhận khoản chi.");
    } finally {
      setSaving(false);
    }
  }

  function resetEvidence() {
    setBillPreview(null);
    setBillFileName("");
    setBillEvidenceId("");
    setDuplicateEvidence(false);
    setConfirmDuplicateEvidence(false);
    setEvidenceMessage("");
    setAiStatus("idle");
    if (billInputRef.current) billInputRef.current.value = "";
  }

  async function scanBill(file?: File) {
    if (!file) return;
    setSubmitError("");
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Ảnh bill tối đa 5 MB.");
      resetEvidence();
      return;
    }
    setBillFileName(file.name);
    setBillEvidenceId("");
    setDuplicateEvidence(false);
    setConfirmDuplicateEvidence(false);
    setEvidenceMessage("");
    setAiStatus("uploading");
    const reader = new FileReader();
    reader.onload = () => setBillPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("branchId", branchId);
      const response = await fetch("/api/expense-evidence", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể tải ảnh bill.");
      const evidence = data.evidence as {
        id: string;
        scanStatus: "AI_REVIEW_READY" | "AI_UNAVAILABLE" | "AI_FAILED";
        extractedAmount?: number | null;
        extractedVendor?: string | null;
        extractedDate?: string | null;
        extractedCategory?: string | null;
        confidence?: number | null;
        scanNote?: string | null;
        duplicateWarning?: boolean;
      };
      setBillEvidenceId(evidence.id);
      setDuplicateEvidence(Boolean(evidence.duplicateWarning));
      if (evidence.scanStatus === "AI_REVIEW_READY") {
        setAiStatus("ready");
        setAmount((current) => current || (evidence.extractedAmount ? String(evidence.extractedAmount) : ""));
        setCounterparty((current) => current || evidence.extractedVendor || "");
        if (evidence.extractedCategory && EXPENSE_CATEGORIES.includes(evidence.extractedCategory as typeof EXPENSE_CATEGORIES[number])) {
          setCategory(evidence.extractedCategory);
        }
        if (evidence.extractedDate) setExpenseDate(evidence.extractedDate.slice(0, 10));
        setEvidenceMessage(`AI đã trích xuất${evidence.confidence !== null && evidence.confidence !== undefined ? ` · độ tin cậy ${evidence.confidence}%` : ""}. Hãy kiểm tra trước khi ghi nhận.`);
      } else {
        setAiStatus("manual");
        setEvidenceMessage(evidence.scanStatus === "AI_UNAVAILABLE"
          ? "Ảnh đã lưu an toàn. AI chưa được cấu hình, vui lòng nhập và kiểm tra thủ công."
          : "Ảnh đã lưu an toàn nhưng AI chưa đọc được; vui lòng nhập và kiểm tra thủ công.");
      }
    } catch (error) {
      resetEvidence();
      setSubmitError(error instanceof Error ? error.message : "Không thể tải ảnh bill.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7d6ca] bg-[#fdf8f3] text-[#7a3e1d] transition hover:border-[#9f7428]"
        aria-label="Tạo khoản chi phát sinh"
        title="Tạo khoản chi phát sinh"
      >
        <Plus size={17} />
      </button>
      {open && typeof document !== "undefined" ? createPortal((
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Đóng" />
          <form onSubmit={submit} className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="shrink-0 bg-gradient-to-br from-[#241615] via-[#4d2718] to-[#93352d] p-4 text-white sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><ReceiptText size={21} /></span>
                <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e7c878]">Chi phí phát sinh</p><h2 className="mt-1 text-base font-semibold leading-5">Ghi nhận mọi khoản Chi phí phát sinh để hạch toán lãi/lỗ hệ thống</h2><p className="mt-1 text-[11px] text-white/70">Tự động phân loại và ghi nhận đúng cơ sở.</p></div>
                <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-center text-xs font-semibold sm:col-span-2">Số tiền<input required inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-[#d2ad5d] bg-[#fffaf2] px-3 py-3 text-center text-xl font-bold text-[#c64b32] outline-none focus:border-[#c64b32]" />{amount ? <span className="mt-1 block text-[10px] font-normal text-[#826f66]">Ghi nhận vào Tổng chi: {formatMoney(Number(amount.replace(/\D/g, "")) || 0)}</span> : null}</label>
              <label className="text-xs font-semibold sm:col-span-2">Công việc / nội dung chi<input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ví dụ: mua 30 bộ khăn và tinh dầu cho ca tối" className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
              <CompactPicker label="Danh mục chi" value={category} onChange={setCategory} options={[{ value: "AUTO", label: "✨ Tự động phân loại" }, ...EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))]} />
              <CompactPicker label="Phạm vi hạch toán" disabled={session.role !== "OWNER"} value={branchId} onChange={(value) => { if (value !== branchId) resetEvidence(); setBranchId(value); }} options={[...(session.role === "OWNER" ? [{ value: SYSTEM_ACCOUNTING_SCOPE.id, label: "🏢 Chi cho toàn hệ thống" }] : []), ...branches.filter((branch) => session.role === "OWNER" || branch.id === session.branchId).map((branch) => ({ value: branch.id, label: branch.label }))]} />
              <div className="flex items-start gap-2 rounded-xl bg-[#fbf2e7] p-3 text-[11px] leading-4 text-[#715943] sm:col-span-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-[#c64b32]" /><span>Danh mục: <strong className="text-[#c64b32]">{resolvedCategory}</strong>{category === "AUTO" ? " · cập nhật theo nội dung bạn nhập" : " · đã chọn thủ công"}. Hạch toán vào <strong>{branchId === "system" ? "toàn hệ thống" : branches.find((item) => item.id === branchId)?.label}</strong>.</span></div>
              <label className="text-xs font-semibold">Ngày phát sinh<input type="date" required value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold">Nhà cung cấp / người nhận<input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Không bắt buộc" className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold">Ảnh bill đối soát bằng AI <span className="font-normal text-[#826f66]">(khuyến nghị)</span></p>
                <input ref={billInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => void scanBill(event.target.files?.[0])} />
                <button type="button" onClick={() => billInputRef.current?.click()} className="mt-1.5 flex w-full items-center gap-3 rounded-xl border border-dashed border-[#d4ad63] bg-[#fffaf2] p-3 text-left">
                  {/* Bill preview is a local data URL selected by the administrator. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {billPreview ? <img src={billPreview} alt="Bill đã tải" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-[#c64b32]"><ImagePlus size={20} /></span>}
                  <span className="min-w-0 flex-1"><strong className="block truncate text-xs">{billFileName || "Chụp hoặc tải ảnh bill"}</strong><small className="mt-0.5 block text-[10px] font-normal leading-4 text-[#826f66]">JPG, PNG hoặc WEBP · tối đa 5 MB · AI chỉ gợi ý, Admin xác nhận.</small></span>
                  {aiStatus === "uploading" ? <Loader2 size={18} className="animate-spin text-[#c64b32]" /> : aiStatus === "ready" || aiStatus === "manual" ? <FileCheck2 size={18} className="text-[#0b5d45]" /> : <ScanLine size={18} className="text-[#9f7428]" />}
                </button>
                {aiStatus === "uploading" ? <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[#76551d]"><Loader2 size={11} className="animate-spin" /> Đang tải ảnh và đọc chứng từ...</p> : null}
                {evidenceMessage ? <p className={`mt-1.5 flex items-start gap-1 text-[10px] font-medium ${aiStatus === "ready" ? "text-[#0b5d45]" : "text-[#76551d]"}`}><Sparkles size={11} className="mt-0.5 shrink-0" /> {evidenceMessage}</p> : null}
                {duplicateEvidence ? <label className="mt-2 flex items-start gap-2 rounded-xl border border-[#e5b96b] bg-[#fff8e8] p-2.5 text-[10px] leading-4 text-[#715943]"><input type="checkbox" checked={confirmDuplicateEvidence} onChange={(event) => setConfirmDuplicateEvidence(event.target.checked)} className="mt-0.5" /><span><strong>Phát hiện ảnh trùng chứng từ đã hạch toán.</strong> Chỉ xác nhận nếu đây thực sự là một khoản chi khác.</span></label> : null}
              </div>
            </div>
            {submitError ? <p className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{submitError}</p> : null}
            <div className="grid shrink-0 grid-cols-[0.72fr_1.28fr] gap-2 border-t border-[#e7d6ca] bg-white p-4"><button type="button" onClick={() => setOpen(false)} className="rounded-full bg-[#f4eeea] py-2.5 text-sm font-semibold text-[#68574f]">Hủy</button><button type="submit" disabled={saving || aiStatus === "uploading" || (duplicateEvidence && !confirmDuplicateEvidence)} title={submitError || undefined} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#c64b32] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} {saving ? "Đang ghi nhận..." : "Ghi nhận đã chi"}</button></div>
          </form>
        </div>
      ), document.body) : null}
    </>
  );
}

export function AdminCustomerFab() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [relationship, setRelationship] = useState<"WALK_IN" | "FRIEND" | "BOSS" | "PARTNER">("WALK_IN");
  const [branchId, setBranchId] = useState(session?.branchId ?? branches[0].id);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!session) return null;
  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startLeft: rect.left, startTop: rect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;
    setPosition({
      left: Math.min(window.innerWidth - 68, Math.max(12, drag.startLeft + deltaX)),
      top: Math.min(window.innerHeight - 152, Math.max(68, drag.startTop + deltaY)),
    });
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    if (!drag.moved) setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    setSaving(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), branchId, relationship, note: note.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể tạo hồ sơ khách.");
      setFullName("");
      setPhone("");
      setNote("");
      setOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể tạo hồ sơ khách.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => { dragRef.current = null; }}
        style={position ?? undefined}
        className={`fixed z-30 flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-[#c58b2b] to-[#93352d] text-white shadow-lg shadow-[#93352d]/25 ring-2 ring-white ${position ? "" : "bottom-[86px] right-3 md:bottom-6 md:right-6"}`}
        aria-label="Tạo khách nhanh"
        title="Chạm để tạo khách · giữ và kéo để di chuyển"
      ><UserPlus size={19} /></button>
      {open && typeof document !== "undefined" ? createPortal((
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Đóng" />
          <form onSubmit={submit} className="relative flex max-h-[calc(100dvh-12px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[calc(100dvh-40px)] sm:rounded-[2rem]">
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#231514] via-[#56291a] to-[#c64b32] p-5 text-white">
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#e7c878]/15 blur-2xl" />
              <div className="relative flex items-start gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><UserPlus size={22} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e7c878]">CRM tại quầy</p><h2 className="mt-1 text-xl font-semibold">Tiếp nhận khách mới</h2><p className="mt-1 text-xs leading-5 text-white/70">Tạo hồ sơ, ghi nhận nguồn quan hệ và chuyển đúng cơ sở chăm sóc.</p></div><button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={17} /></button></div>
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-[9px] text-white/70"><span className="rounded-xl bg-white/[0.07] px-2 py-2"><UserRound size={14} className="mx-auto mb-1 text-[#e7c878]" />Hồ sơ</span><span className="rounded-xl bg-white/[0.07] px-2 py-2"><Handshake size={14} className="mx-auto mb-1 text-[#e7c878]" />Mối quan hệ</span><span className="rounded-xl bg-white/[0.07] px-2 py-2"><MapPin size={14} className="mx-auto mb-1 text-[#e7c878]" />Cơ sở</span></div>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-xs font-semibold">Tên khách<div className="relative mt-1.5"><UserRound size={15} className="pointer-events-none absolute left-3 top-3 text-[#9f7428]" /><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Họ và tên khách hàng" className="w-full rounded-xl border border-[#e7d6ca] py-2.5 pl-9 pr-3 text-sm font-normal" /></div></label>
              <label className="text-xs font-semibold">Số điện thoại<div className="relative mt-1.5"><Phone size={15} className="pointer-events-none absolute left-3 top-3 text-[#9f7428]" /><input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09..." className="w-full rounded-xl border border-[#e7d6ca] py-2.5 pl-9 pr-3 text-sm font-normal" /></div></label>
              <CompactPicker label="Quan hệ / nguồn khách" value={relationship} onChange={(value) => setRelationship(value as typeof relationship)} options={[{ value: "WALK_IN", label: "Khách đến trực tiếp" }, { value: "FRIEND", label: "Bạn của khách giới thiệu" }, { value: "BOSS", label: "Sếp / đồng nghiệp" }, { value: "PARTNER", label: "Đối tác / Affiliate" }]} />
              <CompactPicker label="Cơ sở tiếp nhận" disabled={session.role !== "OWNER"} value={branchId} onChange={setBranchId} options={branches.filter((branch) => session.role === "OWNER" || branch.id === session.branchId).map((branch) => ({ value: branch.id, label: branch.label }))} />
              <label className="text-xs font-semibold sm:col-span-2">Ghi chú xếp phòng / chăm sóc<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Ví dụ: đi cùng anh Minh, ưu tiên giường gần nhau để tiện trao đổi" className="mt-1.5 w-full resize-none rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
              <div className="flex items-start gap-2 rounded-xl border border-[#efd6a1] bg-[#fff8e8] p-3 text-[11px] leading-5 text-[#715943] sm:col-span-2"><Building2 size={14} className="mt-0.5 shrink-0 text-[#8a5a12]" /><span><strong>{relationship === "WALK_IN" ? "Khách trực tiếp" : relationship === "FRIEND" ? "Khách được bạn giới thiệu" : relationship === "BOSS" ? "Quan hệ sếp / đồng nghiệp" : "Đối tác / Affiliate"}</strong> · quản lý sẽ dùng thông tin này để chăm sóc và bố trí phòng/giường phù hợp.</span></div>
            </div>
            {submitError ? <p className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{submitError}</p> : null}
            <div className="grid shrink-0 grid-cols-[0.72fr_1.28fr] gap-2 border-t border-[#e7d6ca] bg-white p-4"><button type="button" onClick={() => setOpen(false)} className="rounded-full bg-[#f4eeea] py-2.5 text-sm font-semibold text-[#68574f]">Hủy</button><button type="submit" disabled={saving} className="rounded-full bg-gradient-to-r from-[#8b2b28] to-[#b92a2f] py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60">{saving ? "Đang lưu..." : "Tạo hồ sơ khách"}</button></div>
          </form>
        </div>
      ), document.body) : null}
    </>
  );
}
