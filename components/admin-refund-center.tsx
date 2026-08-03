"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  Landmark,
  LoaderCircle,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { useAdminSession } from "@/components/admin-session-provider";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";

type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
type RefundSource = {
  id: string;
  type: "DEPOSIT" | "SERVICE_PAYMENT";
  amount: number;
  refundableAmount: number;
  branchId: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  referenceCode: string;
  paidAt: string;
};
type RefundItem = {
  id: string;
  status: RefundStatus;
  amount: number;
  reason: string;
  branchId: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  referenceCode: string;
  sourceType: "DEPOSIT" | "SERVICE_PAYMENT";
  sourceAmount: number;
  requestedById: string;
  requestedByName: string;
  approvedByName?: string | null;
  completedByName?: string | null;
  approvalNote?: string | null;
  bankReference?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
};
type RefundData = {
  role: "OWNER" | "BRANCH_MANAGER";
  actorId: string;
  requests: RefundItem[];
  sources: RefundSource[];
};

const statusMeta: Record<RefundStatus, { label: string; tone: string; icon: typeof Clock3 }> = {
  REQUESTED: { label: "Chờ duyệt", tone: "border-[#e8d39e] bg-[#fff8e8] text-[#76551d]", icon: Clock3 },
  APPROVED: { label: "Đã duyệt · chờ chuyển", tone: "border-[#b9d8e8] bg-[#edf7fc] text-[#236580]", icon: BadgeCheck },
  COMPLETED: { label: "Đã hoàn tiền", tone: "border-[#e8d2c4] bg-[#fbf2e7] text-[#76551d]", icon: CheckCircle2 },
  REJECTED: { label: "Đã từ chối", tone: "border-[#efc6be] bg-[#f8ebe5] text-[#c64b32]", icon: XCircle },
  CANCELLED: { label: "Đã hủy", tone: "border-[#ddd4cf] bg-[#f6f2ef] text-[#70645e]", icon: Ban },
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminRefundCenter() {
  const { session } = useAdminSession();
  const [data, setData] = useState<RefundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"ALL" | RefundStatus>("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bankReferences, setBankReferences] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/refunds", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể tải dữ liệu hoàn tiền.");
      setData(payload);
      setSelectedSourceId((current) => current || payload.sources[0]?.id || "");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể tải dữ liệu hoàn tiền." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const selectedSource = data?.sources.find((item) => item.id === selectedSourceId);
  const filtered = useMemo(
    () => (data?.requests ?? []).filter((item) => filter === "ALL" || item.status === filter),
    [data?.requests, filter],
  );
  const counts = useMemo(() => ({
    requested: data?.requests.filter((item) => item.status === "REQUESTED").length ?? 0,
    approved: data?.requests.filter((item) => item.status === "APPROVED").length ?? 0,
    completedAmount: data?.requests.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + item.amount, 0) ?? 0,
  }), [data?.requests]);

  if (session && !["OWNER", "BRANCH_MANAGER"].includes(session.role)) {
    return <main className="mx-auto max-w-xl px-4 py-12 text-center"><ShieldCheck className="mx-auto text-[#c64b32]" /><h1 className="mt-3 text-lg font-semibold">Khu vực nghiệp vụ có kiểm soát</h1><p className="mt-2 text-sm text-[#826f66]">Chỉ Chủ Tâm An và Quản lý cơ sở được truy cập quy trình hoàn tiền.</p><Link href="/admin" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c64b32] px-4 py-2 text-sm font-semibold text-white"><ArrowLeft size={15} /> Về trang quản trị</Link></main>;
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy("create");
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePaymentId: selectedSourceId, amount: Number(amount), reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể lập yêu cầu hoàn tiền.");
      setAmount("");
      setReason("");
      setMessage({ tone: "ok", text: "Đã lập yêu cầu. Khoản tiền chưa được ghi là đã hoàn cho đến khi Chủ duyệt và xác nhận mã ngân hàng." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể lập yêu cầu hoàn tiền." });
    } finally {
      setBusy("");
    }
  }

  async function transition(item: RefundItem, action: "APPROVE" | "REJECT" | "COMPLETE" | "CANCEL") {
    setMessage(null);
    setBusy(`${item.id}:${action}`);
    try {
      const response = await fetch(`/api/refunds/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[item.id] || undefined, bankReference: bankReferences[item.id] || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật yêu cầu hoàn tiền.");
      setMessage({ tone: "ok", text: action === "COMPLETE" ? "Đã ghi nhận giao dịch hoàn tiền và hạch toán vào sổ cái." : "Trạng thái yêu cầu đã được cập nhật." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Không thể cập nhật yêu cầu hoàn tiền." });
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#201413] via-[#4c281e] to-[#8b2b28] p-4 text-white shadow-xl sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-[#f0c65e]/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><RotateCcw size={21} /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e7c878]">Kiểm soát hai lớp · Sổ cái thật</p><h1 className="mt-0.5 text-xl font-semibold">Trung tâm hoàn tiền</h1><p className="mt-1 max-w-2xl text-[11px] leading-4 text-white/70">Quản lý lập yêu cầu · Chủ khác phê duyệt · chỉ hạch toán khi đã có mã chuyển khoản ngân hàng.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="Tải lại"><RefreshCcw size={15} className={loading ? "animate-spin" : ""} /></button>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Chờ duyệt<strong className="mt-0.5 block text-sm text-white">{counts.requested}</strong></span>
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Chờ chuyển<strong className="mt-0.5 block text-sm text-[#dff4ff]">{counts.approved}</strong></span>
          <span className="rounded-xl bg-white/[0.07] p-2 text-[9px] text-white/55">Đã hoàn<strong className="mt-0.5 block truncate text-sm text-[#e7c878]">{formatMoney(counts.completedAmount)}</strong></span>
        </div>
      </section>

      {message ? <div role="status" className={cn("mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5", message.tone === "ok" ? "border-[#e8d2c4] bg-[#fbf2e7] text-[#76551d]" : "border-[#efc6be] bg-[#f8ebe5] text-[#c64b32]")}>{message.text}</div> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.78fr_1.22fr]">
        <form onSubmit={submitRequest} className="h-fit rounded-2xl border border-[#d2ad5d]/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8ebe5] text-[#c64b32]"><ReceiptText size={18} /></span><div><h2 className="text-sm font-semibold">Lập yêu cầu hoàn tiền</h2><p className="mt-0.5 text-[10px] leading-4 text-[#826f66]">Hạn mức tính từ khoản thu dịch vụ/cọc gốc; không bao gồm phần Tip KTV.</p></div></div>
          <div className="mt-4 space-y-3">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7c6256]">Giao dịch gốc
              <CompactSelect
                className="mt-1.5"
                value={selectedSourceId}
                onValueChange={(value) => { setSelectedSourceId(value); setAmount(""); }}
                dialogTitle="Chọn khoản thu đã đối soát"
                placeholder={loading ? "Đang tải giao dịch…" : "Chọn giao dịch có thể hoàn"}
                disabled={loading || !data?.sources.length}
                options={(data?.sources ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.customerName} · ${displayBookingCode(item.referenceCode)}`,
                  description: `${item.branchName} · ${item.type === "DEPOSIT" ? "Tiền cọc" : "Tiền dịch vụ"} · còn ${formatMoney(item.refundableAmount)}`,
                }))}
              />
            </label>
            {selectedSource ? <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#fdf8f3] p-3 text-center text-[10px] text-[#826f66]"><span>Khoản thu gốc<strong className="mt-1 block text-xs text-[#281b18]">{formatMoney(selectedSource.amount)}</strong></span><span>Còn có thể hoàn<strong className="mt-1 block text-xs text-[#76551d]">{formatMoney(selectedSource.refundableAmount)}</strong></span></div> : <p className="rounded-xl border border-dashed border-[#e7d6ca] p-4 text-center text-[10px] text-[#826f66]">Không có khoản thu đủ điều kiện trong phạm vi của bạn.</p>}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7c6256]">Số tiền hoàn
              <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} max={selectedSource?.refundableAmount} placeholder="0" className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-3 text-center text-lg font-semibold outline-none focus:border-[#c64b32]" />
              {amount ? <span className="mt-1 block text-center text-[10px] font-normal normal-case tracking-normal text-[#76551d]">{formatMoney(Number(amount))}</span> : null}
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7c6256]">Lý do và căn cứ
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} rows={3} placeholder="Ví dụ: Khách hủy đúng điều kiện chính sách, hoàn lại tiền cọc…" className="mt-1.5 w-full resize-none rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#c64b32]" />
            </label>
            <button disabled={busy === "create" || !selectedSource || !amount || reason.trim().length < 10 || Number(amount) > (selectedSource?.refundableAmount ?? 0)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c64b32] px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy === "create" ? <LoaderCircle size={15} className="animate-spin" /> : <UserRoundCheck size={15} />} Gửi Chủ phê duyệt</button>
            <p className="text-center text-[9px] leading-4 text-[#826f66]">Lập yêu cầu không đồng nghĩa đã trả tiền. Người lập không được tự phê duyệt.</p>
          </div>
        </form>

        <section className="min-w-0 rounded-2xl border border-[#d2ad5d]/60 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Sổ yêu cầu hoàn tiền</h2><p className="mt-0.5 text-[10px] text-[#826f66]">{data?.requests.length ?? 0} yêu cầu · đầy đủ người lập, người duyệt và mã ngân hàng</p></div><Landmark size={18} className="text-[#c64b32]" /></div>
          <div className="scrollbar-hide mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {(["ALL", "REQUESTED", "APPROVED", "COMPLETED", "REJECTED", "CANCELLED"] as const).map((status) => <button type="button" key={status} onClick={() => setFilter(status)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold", filter === status ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] bg-[#fdf8f3] text-[#68574f]")}>{status === "ALL" ? "Tất cả" : statusMeta[status].label}</button>)}
          </div>
          <div className="mt-3 space-y-2.5">
            {loading ? <div className="flex min-h-32 items-center justify-center text-[#c64b32]"><LoaderCircle className="animate-spin" /></div> : null}
            {!loading && !filtered.length ? <p className="rounded-xl border border-dashed border-[#e7d6ca] p-8 text-center text-xs text-[#826f66]">Chưa có yêu cầu phù hợp bộ lọc.</p> : null}
            {filtered.map((item) => {
              const meta = statusMeta[item.status];
              const StatusIcon = meta.icon;
              const ownRequest = item.requestedById === data?.actorId;
              return <article key={item.id} className="rounded-2xl border border-[#e7d6ca] bg-[#fffdfb] p-3.5">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.customerName} · {displayBookingCode(item.referenceCode)}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#826f66]"><Building2 size={10} /> {item.branchName} · {dateTime(item.createdAt)}</p></div><span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold", meta.tone)}><StatusIcon size={10} /> {meta.label}</span></div>
                <div className="mt-3 grid grid-cols-3 rounded-xl bg-white p-2.5 text-center text-[9px] text-[#826f66] ring-1 ring-[#eee3dc]"><span>Nguồn thu<strong className="mt-0.5 block text-[10px] text-[#281b18]">{item.sourceType === "DEPOSIT" ? "Tiền cọc" : "Dịch vụ"}</strong></span><span>Thu gốc<strong className="mt-0.5 block text-[10px] text-[#281b18]">{formatMoney(item.sourceAmount)}</strong></span><span>Đề nghị hoàn<strong className="mt-0.5 block text-[11px] text-[#c64b32]">{formatMoney(item.amount)}</strong></span></div>
                <p className="mt-2.5 rounded-xl bg-[#fdf8f3] px-3 py-2 text-[10px] leading-4 text-[#68574f]"><strong className="text-[#3b2c26]">Lý do:</strong> {item.reason}</p>
                <div className="mt-2 grid gap-1 text-[9px] leading-4 text-[#826f66] sm:grid-cols-2"><span>Người lập: <strong className="text-[#4c3c34]">{item.requestedByName}</strong></span>{item.approvedByName ? <span>Người duyệt: <strong className="text-[#4c3c34]">{item.approvedByName}</strong></span> : null}{item.completedByName ? <span>Ghi nhận chuyển: <strong className="text-[#4c3c34]">{item.completedByName}</strong></span> : null}{item.bankReference ? <span>Mã ngân hàng: <strong className="text-[#76551d]">{item.bankReference}</strong></span> : null}</div>
                {item.approvalNote ? <p className="mt-1.5 text-[9px] italic leading-4 text-[#806e65]">Ghi chú xử lý: {item.approvalNote}</p> : null}

                {item.status === "REQUESTED" && data?.role === "OWNER" && ownRequest ? <p className="mt-3 rounded-xl border border-[#e8d39e] bg-[#fff8e8] px-3 py-2 text-[10px] leading-4 text-[#76551d]">Bạn là người lập nên không thể tự duyệt. Hãy dùng một tài khoản Chủ độc lập để kiểm tra.</p> : null}
                {item.status === "REQUESTED" ? <div className="mt-3 space-y-2"><input value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={data?.role === "OWNER" && !ownRequest ? "Ghi chú duyệt hoặc lý do từ chối" : "Ghi chú hủy yêu cầu (không bắt buộc)"} className="w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2 text-[10px] outline-none focus:border-[#c64b32]" /><div className="grid grid-cols-2 gap-2">{data?.role === "OWNER" && !ownRequest ? <><button type="button" disabled={Boolean(busy)} onClick={() => void transition(item, "APPROVE")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#76551d] px-3 py-2 text-[10px] font-semibold text-white"><BadgeCheck size={13} /> Phê duyệt</button><button type="button" disabled={Boolean(busy) || (notes[item.id]?.trim().length ?? 0) < 3} onClick={() => void transition(item, "REJECT")} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#c64b32] px-3 py-2 text-[10px] font-semibold text-[#c64b32]"><XCircle size={13} /> Từ chối</button></> : null}{(data?.role === "OWNER" || ownRequest) ? <button type="button" disabled={Boolean(busy)} onClick={() => void transition(item, "CANCEL")} className={cn("flex items-center justify-center gap-1.5 rounded-xl border border-[#d7ccc5] px-3 py-2 text-[10px] font-semibold text-[#68574f]", data?.role === "OWNER" && !ownRequest ? "col-span-2" : "col-span-2")}><Ban size={13} /> Hủy yêu cầu</button> : null}</div></div> : null}
                {item.status === "APPROVED" && data?.role === "OWNER" ? <div className="mt-3 rounded-xl border border-[#b9d8e8] bg-[#f5fbfe] p-3"><p className="text-[10px] font-semibold text-[#236580]">Xác nhận sau khi ngân hàng đã chuyển</p><input value={bankReferences[item.id] ?? ""} onChange={(event) => setBankReferences((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Mã giao dịch ngân hàng duy nhất" className="mt-2 w-full rounded-xl border border-[#b9d8e8] bg-white px-3 py-2 text-[10px] outline-none focus:border-[#236580]" /><button type="button" disabled={Boolean(busy) || (bankReferences[item.id]?.trim().length ?? 0) < 4} onClick={() => void transition(item, "COMPLETE")} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#236580] px-3 py-2.5 text-[10px] font-semibold text-white"><Landmark size={13} /> Xác nhận đã chuyển & hạch toán</button></div> : null}
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
