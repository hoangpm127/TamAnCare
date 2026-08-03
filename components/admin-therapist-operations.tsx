"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Clock3, Loader2, MessageSquareWarning, QrCode, RefreshCcw, UserRound } from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { useAdminSession } from "@/components/admin-session-provider";
import { TherapistAvatar } from "@/components/therapist-avatar";
import { cn } from "@/lib/utils";

type LiveStatus = "AVAILABLE" | "BUSY" | "BUSINESS" | "WRAP_UP" | "OFF";
type TherapistView = {
  id: string;
  branchId: string;
  fullName: string;
  shiftLabel: string;
  ratingAvg: number;
  avatarUrl: string | null;
  publicBio: string | null;
  publicStrengths: string[];
  profileApprovalStatus: "DRAFT" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  proposedAvatarUrl: string | null;
  proposedBio: string | null;
  proposedStrengths: string[];
  profileSubmittedAt: string | null;
  profileReviewNote: string | null;
  liveStatus: LiveStatus;
  live: null | { type: "CARE" | "BUSINESS"; label: string; detail: string; serviceName: string; roomName: string | null; startedAt: string; expectedEndAt: string; requiredTherapists: number };
  wrapUp: null | { customerName: string; checkoutRequestedAt: string | null };
  next: null | { type: "CARE" | "BUSINESS"; label: string; customerName: string; startsAt: string };
};
type Payload = {
  generatedAt: string;
  branches: Array<{ id: string; label: string }>;
  therapists: TherapistView[];
  businessStaffing: Array<{ eventCode: string; branchId: string; companyName: string; requiredTherapists: number; trackedTherapists: number; staffingGap: number }>;
};

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function remaining(value: string, now: number) {
  const rawSeconds = Math.ceil((new Date(value).getTime() - now) / 1000);
  if (rawSeconds <= 0) return `Quá ${Math.max(1, Math.ceil(Math.abs(rawSeconds) / 60))} phút`;
  const seconds = rawSeconds;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${Math.max(1, minutes)} phút`;
}

const STYLE: Record<LiveStatus, { card: string; badge: string; label: string }> = {
  AVAILABLE: { card: "border-[#d2ad5d] bg-gradient-to-br from-[#fbf2e7] to-white", badge: "bg-[#f1e5dd] text-[#76551d]", label: "RẢNH" },
  BUSY: { card: "border-[#efb5b2] bg-gradient-to-br from-[#fff0ef] to-white", badge: "bg-[#ffd8d5] text-[#a32b2b]", label: "BẬN" },
  BUSINESS: { card: "border-[#a8c8ef] bg-gradient-to-br from-[#eef5ff] to-white", badge: "bg-[#dbeaff] text-[#2452b8]", label: "BUSINESS" },
  WRAP_UP: { card: "border-[#e8d39e] bg-gradient-to-br from-[#fff8e8] to-white", badge: "bg-[#f8e8bd] text-[#76551d]", label: "CHỜ ĐÓNG BILL" },
  OFF: { card: "border-[#d8d0cb] bg-[#f5f2f0]", badge: "bg-[#e8e2de] text-[#6f625b]", label: "NGHỈ" },
};

export function AdminTherapistOperations() {
  const { session } = useAdminSession();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [branchId, setBranchId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!session) return;
    if (!quiet) setLoading(true);
    try {
      const query = session.role === "OWNER" && branchId !== "all" ? `?branchId=${encodeURIComponent(branchId)}` : "";
      const response = await fetch(`/api/admin-therapists/status${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể tải trạng thái KTV.");
      setPayload(data as Payload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải trạng thái KTV.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [branchId, session]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const poller = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(poller);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const therapists = payload?.therapists ?? [];
    return {
      total: therapists.length,
      available: therapists.filter((item) => item.liveStatus === "AVAILABLE").length,
      busy: therapists.filter((item) => item.liveStatus === "BUSY").length,
      business: therapists.filter((item) => item.liveStatus === "BUSINESS").length,
      wrapUp: therapists.filter((item) => item.liveStatus === "WRAP_UP").length,
    };
  }, [payload]);
  const pendingProfiles = useMemo(() => (payload?.therapists ?? []).filter((item) => item.profileApprovalStatus === "PENDING"), [payload]);

  async function reviewProfile(therapistId: string, decision: "APPROVE" | "REQUEST_CHANGES") {
    const note = reviewNotes[therapistId]?.trim() ?? "";
    if (decision === "REQUEST_CHANGES" && !note) {
      setError("Hãy ghi rõ nội dung KTV cần bổ sung trước khi yêu cầu chỉnh sửa.");
      return;
    }
    setReviewingId(therapistId);
    try {
      const response = await fetch("/api/admin-therapists/profile-review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ therapistId, decision, note: note || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể duyệt hồ sơ KTV.");
      setReviewNotes((current) => ({ ...current, [therapistId]: "" }));
      await load(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể duyệt hồ sơ KTV.");
    } finally {
      setReviewingId(null);
    }
  }
  if (!session) return null;

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#76551d] to-[#a85f29] px-3.5 py-3 text-center text-white shadow-lg">
        <button type="button" onClick={() => void load()} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10" aria-label="Làm mới"><RefreshCcw size={14} className={loading ? "animate-spin" : ""} /></button>
        <h1 className="text-lg font-semibold">KTV bận/rảnh tức thì</h1>
        <p className="mt-0.5 text-[10px] text-white/70">Booking tại cơ sở và Tâm An Business · tự cập nhật mỗi 5 giây</p>
        <div className="mx-auto mt-2 flex max-w-xl flex-wrap items-center justify-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{summary.total} KTV</span>
          <span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 text-[#76551d]">{summary.available} rảnh</span>
          <span className="rounded-full bg-[#ffe0de] px-2.5 py-1 text-[#9b2929]">{summary.busy} tại cơ sở</span>
          <span className="rounded-full bg-[#dbeaff] px-2.5 py-1 text-[#2452b8]">{summary.business} Business</span>
          {summary.wrapUp ? <span className="rounded-full bg-[#ffedbd] px-2.5 py-1 text-[#76551d]">{summary.wrapUp} chờ đóng Bill</span> : null}
        </div>
      </section>

      <section className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[#d2ad5d]/55 bg-white p-2 shadow-sm">
        <CompactSelect value={session.role === "OWNER" ? branchId : session.branchId ?? "all"} onValueChange={setBranchId} disabled={session.role !== "OWNER"} dialogTitle="Chọn cơ sở xem KTV" triggerClassName="min-h-9 rounded-lg py-2" options={[{ value: "all", label: "Toàn hệ thống" }, ...(payload?.branches ?? []).map((branch) => ({ value: branch.id, label: branch.label }))]} />
        <Link href="/admin/qr-management" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#76551d] px-3 text-[10px] font-semibold text-white"><QrCode size={13} /> Quản lý QR</Link>
      </section>
      {pendingProfiles.length ? <section className="mt-3 rounded-2xl border border-[#d2ad5d] bg-gradient-to-br from-[#fffaf0] to-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Hồ sơ KTV chờ duyệt</h2><p className="mt-0.5 text-[9px] text-[#826f66]">Chỉ thông tin được duyệt mới hiển thị cho khách lựa chọn</p></div><span className="rounded-full bg-[#fff0c8] px-2.5 py-1 text-[9px] font-bold text-[#76551d]">{pendingProfiles.length} hồ sơ</span></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{pendingProfiles.map((therapist) => <article key={therapist.id} className="rounded-2xl border border-[#e7d6ca] bg-white p-3">
          <div className="flex items-start gap-3"><TherapistAvatar id={therapist.id} src={therapist.proposedAvatarUrl ?? therapist.avatarUrl} size={58} className="shrink-0 rounded-2xl" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{therapist.fullName}</p><p className="mt-0.5 text-[8px] text-[#826f66]">Gửi {therapist.profileSubmittedAt ? new Date(therapist.profileSubmittedAt).toLocaleString("vi-VN") : "vừa xong"}</p><p className="mt-2 text-[10px] leading-5 text-[#68574f]">{therapist.proposedBio}</p><div className="mt-2 flex flex-wrap gap-1">{therapist.proposedStrengths.map((skill) => <span key={skill} className="rounded-full bg-[#fbf2e7] px-2 py-1 text-[8px] font-semibold text-[#76551d]">{skill}</span>)}</div></div></div>
          <textarea value={reviewNotes[therapist.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [therapist.id]: event.target.value }))} rows={2} placeholder="Ghi chú duyệt hoặc nội dung cần KTV bổ sung..." className="mt-3 w-full rounded-xl border border-[#dfd1c8] p-2.5 text-[10px] outline-none focus:border-[#76551d]" />
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={reviewingId === therapist.id} onClick={() => void reviewProfile(therapist.id, "REQUEST_CHANGES")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f8ebe5] py-2.5 text-[9px] font-semibold text-[#c64b32] disabled:opacity-50"><MessageSquareWarning size={13} /> Yêu cầu bổ sung</button><button type="button" disabled={reviewingId === therapist.id} onClick={() => void reviewProfile(therapist.id, "APPROVE")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#76551d] py-2.5 text-[9px] font-semibold text-white disabled:opacity-50">{reviewingId === therapist.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Duyệt công khai</button></div>
        </article>)}</div>
      </section> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
      {loading && !payload ? <div className="mt-3 flex min-h-48 items-center justify-center rounded-2xl border border-[#e7d6ca] bg-white text-[#76551d]"><Loader2 className="mr-2 animate-spin" size={18} /> Đang đồng bộ KTV...</div> : null}

      <div className="mt-3 space-y-3">
        {(payload?.branches ?? []).map((branch) => {
          const therapists = payload?.therapists.filter((item) => item.branchId === branch.id) ?? [];
          const gap = payload?.businessStaffing.filter((item) => item.branchId === branch.id).reduce((sum, item) => sum + item.staffingGap, 0) ?? 0;
          return <section key={branch.id} className="rounded-2xl border border-[#d2ad5d]/50 bg-white p-3 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{branch.label}</h2><p className="text-[9px] text-[#826f66]">{therapists.filter((item) => item.liveStatus === "AVAILABLE").length}/{therapists.length} KTV rảnh ngay</p></div>{gap ? <span className="rounded-full bg-[#f8ebe5] px-2.5 py-1 text-[9px] font-bold text-[#c64b32]">Business cần gán thêm {gap} KTV</span> : null}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {therapists.map((therapist) => {
                const style = STYLE[therapist.liveStatus];
                return <article key={therapist.id} className={cn("overflow-hidden rounded-xl border p-2.5", style.card)}>
                  <div className="flex items-start justify-between gap-1"><Link href={`/admin/therapists/${therapist.id}`} className="min-w-0 truncate text-[11px] font-semibold hover:underline">{therapist.fullName}</Link><span className={cn("shrink-0 rounded-full px-2 py-1 text-[7px] font-bold", style.badge)}>{style.label}</span></div>
                  <p className="mt-0.5 text-[8px] text-[#826f66]">{therapist.shiftLabel} · {therapist.ratingAvg.toFixed(1)}★</p>
                  {therapist.live ? <div className="mt-2 border-t border-current/10 pt-2"><p className={cn("truncate text-[9px] font-semibold", therapist.live.type === "BUSINESS" ? "text-[#2452b8]" : "text-[#c64b32]")}>{therapist.live.type === "BUSINESS" ? <BriefcaseBusiness size={10} className="mr-1 inline" /> : <UserRound size={10} className="mr-1 inline" />}{therapist.live.label}</p><p className="mt-0.5 truncate text-[8px] text-[#68574f]">{therapist.live.serviceName}{therapist.live.roomName ? ` · ${therapist.live.roomName}` : ""}</p><p className="mt-1 text-[8px] font-bold"><Clock3 size={9} className="mr-1 inline" />{remaining(therapist.live.expectedEndAt, now)} · đến {time(therapist.live.expectedEndAt)}</p></div> : therapist.wrapUp ? <div className="mt-2 border-t border-[#ead6a2] pt-2"><p className="truncate text-[9px] font-semibold text-[#76551d]">{therapist.wrapUp.customerName}</p><p className="mt-1 text-[8px] text-[#806e65]">Đã check-out · quầy cần đóng Bill</p></div> : therapist.next ? <div className="mt-2 border-t border-[#e8d2c4] pt-2"><p className="text-[8px] text-[#826f66]">Ca kế tiếp</p><p className="mt-0.5 truncate text-[9px] font-semibold">{time(therapist.next.startsAt)} · {therapist.next.label}</p></div> : <p className="mt-2 text-[8px] leading-3.5 text-[#a85f29]">Sẵn sàng nhận khách ngay</p>}
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
    </main>
  );
}
