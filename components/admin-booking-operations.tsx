"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { isSameDay, startOfDay } from "date-fns";
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Handshake,
  MapPin,
  MessageCircleMore,
  Phone,
  Send,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { usePublicCatalog } from "@/lib/catalog-store";
import { branches as demoBranches, services as demoServices } from "@/lib/demo-data";
import { displayBookingCode, formatMoney, makeBookingCode } from "@/lib/utils";
import { useAdminSession } from "@/components/admin-session-provider";
import { CompactSelect } from "@/components/compact-select";
import { AdminBookingCalendar } from "@/components/admin-booking-calendar";
import {
  confirmAdminBookingRequest,
  registerAdminBookingRequest,
  rejectAdminBookingRequest,
  type AdminBusinessRequest,
  type AdminBookingRequest,
  useAdminBusinessRequests,
  useAdminBookingRequests,
} from "@/lib/admin-booking-store";

const QUICK_REASONS = [
  "Khung giờ này vừa kín lịch, Tâm An xin phép hỗ trợ bạn chọn giờ gần nhất.",
  "KTV bạn chọn đang có lịch đột xuất, Tâm An xin phép đổi KTV tương đương hoặc đổi giờ.",
  "Cơ sở cần thêm thời gian chuẩn bị phòng, mong bạn chọn giúp Tâm An khung giờ kế tiếp.",
  "Tâm An chưa thể xác nhận lịch này và rất tiếc vì sự bất tiện. Chúng tôi sẽ ưu tiên hỗ trợ bạn đổi lịch.",
];

function statusMeta(status: AdminBookingRequest["status"], rawStatus: string) {
  if (rawStatus === "COMPLETED") return { label: "Đã hoàn tất", className: "bg-[#edf9f2] text-[#16784a]" };
  if (rawStatus === "IN_SERVICE") return { label: "Đang phục vụ", className: "bg-[#eef4ff] text-[#2452b8]" };
  if (rawStatus === "CHECKED_IN") return { label: "Đã check-in", className: "bg-[#eef4ff] text-[#2452b8]" };
  if (status === "CONFIRMED") return { label: "Đã xác nhận", className: "bg-[#edf9f2] text-[#16784a]" };
  if (status === "REJECTED") return { label: "Cần đổi lịch", className: "bg-[#fff1ef] text-[#d13f1f]" };
  return { label: "Chờ xác nhận", className: "bg-[#fff7df] text-[#805914]" };
}

function businessStatusMeta(status: string) {
  if (status === "AWAITING_DEPOSIT") return { label: "Chờ đối soát cọc", className: "bg-[#fff7df] text-[#805914]" };
  if (status === "DEPOSIT_CONFIRMED") return { label: "Mới · Cần xác nhận", className: "bg-[#edf9f2] text-[#1d8f55]" };
  if (status === "READY") return { label: "Đã xác nhận", className: "bg-[#edf9f2] text-[#16784a]" };
  if (status === "IN_SERVICE") return { label: "Đang triển khai", className: "bg-[#eef4ff] text-[#2452b8]" };
  if (status === "AWAITING_BALANCE") return { label: "Chờ thanh toán", className: "bg-[#fff7df] text-[#805914]" };
  if (status === "COMPLETED") return { label: "Đã hoàn tất", className: "bg-[#edf9f2] text-[#16784a]" };
  return { label: "Đã hủy", className: "bg-[#f3efec] text-[#8a7a72]" };
}

function ManualBookingDialog({ onClose }: { onClose: () => void }) {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const services = catalog?.services ?? demoServices;
  const { session } = useAdminSession();
  const [code, setCode] = useState(() => makeBookingCode("HD"));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0].id);
  const [timeIso, setTimeIso] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return `${next.toISOString().slice(0, 10)}T10:00`;
  });
  const [branchId, setBranchId] = useState(session?.branchId ?? branches[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!session) return null;

  const selectedService = services.find((item) => item.id === serviceId) ?? services[0];
  const totalAmount = selectedService.basePrice + selectedService.therapistFee;
  const depositAmount = Math.round(totalAmount * 0.1);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCode: code.trim(), customerName: customerName.trim(), customerPhone: customerPhone.trim(), serviceId, branchId, startTime: new Date(timeIso).toISOString(), source: "ADMIN_MANUAL" }),
      });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể tạo booking.");
      registerAdminBookingRequest();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo booking.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5">
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d13f1f]">Booking thủ công</p><h2 className="mt-1 text-lg font-semibold">Tạo yêu cầu đặt lịch</h2></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ec]" aria-label="Đóng"><X size={17} /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Số phiếu nội bộ<input required value={code} onChange={(event) => setCode(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Khách hàng<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm font-normal" placeholder="Họ tên khách" /></label>
          <label className="text-xs font-semibold">Số điện thoại<input required value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm font-normal" inputMode="tel" /></label>
          <div><p className="text-xs font-semibold">Dịch vụ</p><CompactSelect className="mt-1.5" value={serviceId} onValueChange={setServiceId} dialogTitle="Chọn dịch vụ" triggerClassName="text-sm font-normal" options={services.map((service) => ({ value: service.id, label: `${service.name} · ${formatMoney(service.basePrice + service.therapistFee)}` }))} /></div>
          <label className="text-xs font-semibold">Ngày giờ<input required type="datetime-local" value={timeIso} onChange={(event) => setTimeIso(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm font-normal" /></label>
          <div><p className="text-xs font-semibold">Cơ sở</p><CompactSelect className="mt-1.5" disabled={session.role !== "OWNER"} value={branchId} onValueChange={setBranchId} dialogTitle="Chọn cơ sở booking" triggerClassName="text-sm font-normal" options={branches.map((branch) => ({ value: branch.id, label: branch.label }))} /></div>
          <label className="text-xs font-semibold">Tổng dịch vụ<input readOnly value={formatMoney(totalAmount)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-[#fffaf6] px-3 py-2.5 text-sm font-semibold" /></label>
          <label className="text-xs font-semibold">Cọc giữ chỗ 10%<input readOnly value={formatMoney(depositAmount)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-[#fffaf6] px-3 py-2.5 text-sm font-semibold text-[#d13f1f]" /></label>
        </div>
        {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[#eadbd1] py-2.5 text-sm font-semibold">Hủy</button><button disabled={saving} className="rounded-full bg-[#d13f1f] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Đang tạo..." : "Tạo booking"}</button></div>
      </form>
    </div>
  );
}

function CustomerChat({ request, initialMessage, onClose }: { request: AdminBookingRequest; initialMessage: string; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([initialMessage]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    const response = await fetch(`/api/bookings/${encodeURIComponent(request.bookingCode)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (response.ok) {
      setMessages((current) => [...current, message]);
      setDraft("");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#fffaf6]">
      <header className="flex items-center gap-3 border-b border-[#eadbd1] bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-sm">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ec]" aria-label="Đóng chat"><X size={18} /></button>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d13f1f] text-white"><UserRound size={18} /></span>
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{request.customerName}</h2><p className="text-[10px] text-[#8a7a72]">{request.customerPhone} · {displayBookingCode(request.bookingCode)}</p></div>
        <Phone size={17} className="text-[#d13f1f]" />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-[#eadbd1] bg-white p-3 text-sm leading-5 shadow-sm">Mình đã đặt lịch {request.serviceLabel} và mong Tâm An giữ giúp khung giờ này.</div>
          {messages.map((message, index) => <div key={`${message}-${index}`} className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-[#d13f1f] p-3 text-sm leading-5 text-white shadow-sm">{message}<p className="mt-1 text-right text-[9px] text-white/70">Đã gửi tới khách hàng</p></div>)}
          <div className="rounded-2xl border border-[#e3b23c]/55 bg-[#fff7df] p-3"><p className="text-xs font-semibold text-[#6d4912]">Gợi ý giữ thiện cảm</p><p className="mt-1 text-[11px] leading-4 text-[#715943]">Xin lỗi ngắn gọn, đưa ra 1–2 phương án thay thế và ưu tiên khung giờ gần nhất cho khách.</p></div>
        </div>
      </div>
      <div className="border-t border-[#eadbd1] bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="mx-auto flex max-w-2xl items-end gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} className="min-h-11 flex-1 resize-none rounded-2xl border border-[#eadbd1] px-3 py-2.5 text-sm" placeholder="Nhập tin nhắn chăm sóc khách..." /><button type="button" onClick={sendMessage} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d13f1f] text-white" aria-label="Gửi"><Send size={17} /></button></div>
      </div>
    </div>
  );
}

function CheckoutRecordDialog({ request, onClose, onSaved }: { request: AdminBookingRequest; onClose: () => void; onSaved: () => Promise<boolean> }) {
  const dueAmount = Math.max(0, request.totalAmount - request.paidAmount);
  const actualAmount = String(dueAmount);
  const [method, setMethod] = useState<"CASH" | "CARD_POS" | "BANK_TRANSFER_MANUAL">("BANK_TRANSFER_MANUAL");
  const [externalReference, setExternalReference] = useState("");
  const [note, setNote] = useState("Đã kiểm đếm và đối soát tại quầy");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const received = Math.max(0, Number(actualAmount) || 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingCode: request.bookingCode,
          actualAmount: received,
          method,
          externalReference: externalReference.trim() || undefined,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể ghi nhận thanh toán.");
      const completed = await onSaved();
      if (!completed) throw new Error("Đã ghi nhận thanh toán nhưng chưa thể đóng ca. Vui lòng kiểm tra thông báo phía sau và thử hoàn tất lại.");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ghi nhận thanh toán.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-5">
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d13f1f]">Đối soát tại quầy</p><h2 className="mt-1 text-lg font-semibold">Xác nhận đã thanh toán</h2><p className="mt-1 text-[11px] text-[#8a7a72]">{displayBookingCode(request.bookingCode)} · {request.customerName}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ec]" aria-label="Đóng"><X size={17} /></button></div>
        <div className="mt-4 rounded-xl bg-[#fffaf6] p-3 text-center"><span className="text-[10px] text-[#8a7a72]">Số tiền Bill cần ghi nhận<strong className="mt-1 block text-lg text-[#d13f1f]">{formatMoney(dueAmount)}</strong></span></div>
        <label className="mt-4 block text-xs font-semibold">Tiền Bill thực nhận<input required readOnly type="number" value={actualAmount} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-[#f8f4f1] px-3 py-3 text-center text-lg font-bold text-[#d13f1f]" /></label>
        <div className="mt-3"><p className="text-xs font-semibold">Phương thức đã nhận</p><CompactSelect className="mt-1.5" value={method} onValueChange={(value) => setMethod(value as typeof method)} dialogTitle="Phương thức thanh toán tại quầy" triggerClassName="text-sm font-normal" options={[{ value: "CASH", label: "Tiền mặt đã kiểm đếm" }, { value: "CARD_POS", label: "Thẻ qua máy POS" }, { value: "BANK_TRANSFER_MANUAL", label: "Chuyển khoản đối soát thủ công" }]} /></div>
        {method !== "CASH" ? <label className="mt-3 block text-xs font-semibold">Mã tham chiếu ngân hàng/POS<input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm font-normal" placeholder="Nhập mã trên biên lai" /></label> : null}
        <label className="mt-3 block text-xs font-semibold">Ghi chú đối soát<textarea required value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-[#eadbd1] p-3 text-sm font-normal" /></label>
        <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-[11px] leading-5 text-[#805914]">Chỉ ghi nhận đúng {formatMoney(dueAmount)} vào Bill. Tip hoàn toàn tùy tâm, khách trao trực tiếp cho KTV và không nhập vào giao dịch này.</p>
        {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[#eadbd1] py-2.5 text-sm font-semibold">Hủy</button><button disabled={saving || received !== dueAmount} className="rounded-full bg-[#16784a] py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang hạch toán..." : "Đã thanh toán"}</button></div>
      </form>
    </div>
  );
}

export function AdminBookingOperations() {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? demoBranches;
  const { session } = useAdminSession();
  const requests = useAdminBookingRequests();
  const businessRequests = useAdminBusinessRequests();
  const [createOpen, setCreateOpen] = useState(false);
  const [rejecting, setRejecting] = useState<AdminBookingRequest | null>(null);
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [chat, setChat] = useState<{ request: AdminBookingRequest; initialMessage: string } | null>(null);
  const [actionError, setActionError] = useState("");
  const [collecting, setCollecting] = useState<AdminBookingRequest | null>(null);
  const [rejectingBusiness, setRejectingBusiness] = useState<AdminBusinessRequest | null>(null);
  const [businessReason, setBusinessReason] = useState("Tâm An Center chưa thể bảo đảm đủ đội ngũ triển khai trong khung giờ đã chọn. Chúng tôi sẽ liên hệ để ưu tiên một lịch phù hợp gần nhất.");
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [calendarBranchId, setCalendarBranchId] = useState(session?.branchId ?? "all");
  const bookingDetailRef = useRef<HTMLDivElement>(null);

  const scoped = useMemo(() => {
    if (!session) return [];
    return requests
      .filter((item) => session.role === "OWNER" || item.branchId === session.branchId)
      .sort((a, b) => {
        const pendingOrder = Number(b.status === "NEW") - Number(a.status === "NEW");
        if (pendingOrder) return pendingOrder;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [requests, session]);

  const scopedBusiness = useMemo(() => {
    if (!session) return [];
    return businessRequests
      .filter((item) => session.role === "OWNER" || item.branchId === session.branchId)
      .sort((a, b) => {
        const actionable = (item: AdminBusinessRequest) => ["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"].includes(item.status) ? 1 : 0;
        const actionOrder = actionable(b) - actionable(a);
        return actionOrder || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [businessRequests, session]);

  if (!session) return null;
  const activeSession = session;
  const activeBranchId = session.role === "OWNER" ? calendarBranchId : session.branchId ?? branches[0].id;
  const selectedRegular = scoped.filter((item) => (activeBranchId === "all" || item.branchId === activeBranchId) && isSameDay(new Date(item.timeIso), selectedDay));
  const selectedBusiness = scopedBusiness.filter((item) => (activeBranchId === "all" || item.branchId === activeBranchId) && isSameDay(new Date(item.startsAt), selectedDay));
  const businessPending = selectedBusiness.filter((item) => ["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"].includes(item.status)).length;

  function selectBookingDay(day: Date) {
    setSelectedDay(startOfDay(day));
    window.setTimeout(() => bookingDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function confirm(request: AdminBookingRequest) {
    await transitionBooking(request, "CONFIRMED");
  }

  async function transitionBooking(request: AdminBookingRequest, status: "CONFIRMED" | "IN_SERVICE" | "COMPLETED") {
    setActionError("");
    const response = await fetch(`/api/bookings/${encodeURIComponent(request.bookingCode)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setActionError(data.error ?? "Không thể xác nhận lịch.");
      return false;
    }
    confirmAdminBookingRequest(request.bookingCode, activeSession.displayName);
    return true;
  }

  async function rejectAndChat() {
    if (!rejecting || !reason.trim()) return;
    const message = reason.trim();
    await fetch(`/api/bookings/${encodeURIComponent(rejecting.bookingCode)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED", actorName: activeSession.displayName, reason: message }),
    }).catch(() => undefined);
    rejectAdminBookingRequest(rejecting.bookingCode, activeSession.displayName, message);
    setChat({ request: { ...rejecting, status: "REJECTED", rejectionReason: message }, initialMessage: message });
    setRejecting(null);
  }

  async function rejectBusiness() {
    if (!rejectingBusiness || businessReason.trim().length < 10) return;
    setActionError("");
    const response = await fetch(`/api/business-events/${encodeURIComponent(rejectingBusiness.eventCode)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "REJECT", reason: businessReason.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setActionError(data.error ?? "Không thể từ chối lịch Business.");
      return;
    }
    setRejectingBusiness(null);
    confirmAdminBookingRequest();
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <AdminBookingCalendar session={session} regular={scoped} business={scopedBusiness} branchId={activeBranchId} selectedDay={selectedDay} onBranchChange={setCalendarBranchId} onDaySelect={selectBookingDay} onCreate={() => setCreateOpen(true)} />

      {actionError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{actionError}</p> : null}

      <div ref={bookingDetailRef} className="mt-3 scroll-mt-28 rounded-2xl border border-[#d8b46a]/60 bg-[#fffaf4] px-3.5 py-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#d13f1f]">Booking theo ngày</p><h2 className="mt-0.5 text-sm font-semibold capitalize">{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(selectedDay)}</h2></div><span className="rounded-full bg-[#291714] px-2.5 py-1 text-[9px] font-semibold text-white">{selectedRegular.length + selectedBusiness.length} Booking</span></div></div>

      {selectedBusiness.length > 0 ? (
        <section className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div><p className="flex items-center gap-1.5 text-sm font-bold text-[#1d8f55]"><BriefcaseBusiness size={15} /> Lịch Tâm An Business</p><p className="mt-0.5 text-[10px] text-[#8a7a72]">Lịch doanh nghiệp mới được đẩy lên trước để điều phối.</p></div>
            {businessPending > 0 ? <span className="rounded-full bg-[#edf9f2] px-2.5 py-1 text-[10px] font-bold text-[#1d8f55]">{businessPending} cần xử lý</span> : null}
          </div>
          <div className="space-y-3">
            {selectedBusiness.map((request) => {
              const status = businessStatusMeta(request.status);
              const remaining = Math.max(0, request.totalAmount - request.paidAmount);
              const actionable = ["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"].includes(request.status);
              return (
                <article key={request.eventCode} className="overflow-hidden rounded-2xl border border-[#8fd3ad] bg-white shadow-sm">
                  <div className="border-b border-[#d5eadc] bg-gradient-to-r from-[#edf9f2] to-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-bold">{request.companyName}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#1d8f55]"><Building2 size={11} /> {request.branchName}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                    </div>
                    <div className="mt-2 grid gap-1.5 text-[11px] text-[#665b55] sm:grid-cols-2">
                      <p className="flex items-center gap-1.5"><CalendarClock size={12} className="shrink-0 text-[#1d8f55]" /> {new Date(request.startsAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                      <p className="flex min-w-0 items-center gap-1.5"><MapPin size={12} className="shrink-0 text-[#1d8f55]" /><span className="truncate">{request.location}</span></p>
                      <p className="flex items-center gap-1.5"><Users size={12} className="shrink-0 text-[#1d8f55]" /> {request.headcount} người · {request.requiredTherapists} KTV</p>
                      <p className="truncate">{request.contactName} · {request.contactPhone}</p>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <p className="text-xs font-semibold">{request.serviceLabel}{request.packageTier ? ` · ${request.packageTier}` : ""}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-xl border border-[#f0e3da] p-2"><span className="block text-[9px] text-[#8a7a72]">Tổng Bill</span><strong className="mt-0.5 block text-xs">{formatMoney(request.totalAmount)}</strong></div><div className="rounded-xl border border-[#d5eadc] bg-[#f3fbf6] p-2"><span className="block text-[9px] text-[#56806a]">Đã cọc</span><strong className="mt-0.5 block text-xs text-[#16784a]">{formatMoney(request.paidAmount)}</strong></div><div className="rounded-xl border border-[#f0e3da] p-2"><span className="block text-[9px] text-[#8a7a72]">Còn lại</span><strong className="mt-0.5 block text-xs">{formatMoney(remaining)}</strong></div></div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {actionable ? <button type="button" onClick={() => { setRejectingBusiness(request); setBusinessReason("Tâm An Center chưa thể bảo đảm đủ đội ngũ triển khai trong khung giờ đã chọn. Chúng tôi sẽ liên hệ để ưu tiên một lịch phù hợp gần nhất."); }} className="inline-flex items-center justify-center gap-1 rounded-full border border-[#d13f1f] px-3 py-2.5 text-xs font-semibold text-[#d13f1f]"><XCircle size={13} /> Từ chối & lý do</button> : <span />}
                      <Link href={`/admin/business/${request.eventCode}`} className="inline-flex items-center justify-center gap-1 rounded-full bg-[#1d8f55] px-3 py-2.5 text-xs font-semibold text-white">{request.status === "DEPOSIT_CONFIRMED" ? "Xác nhận & phân công" : "Xem hồ sơ"}<ChevronRight size={13} /></Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-3 space-y-3">
        {selectedRegular.map((request) => {
          const status = statusMeta(request.status, request.rawStatus);
          const isDeposited = ["DEPOSITED", "PAID"].includes(request.paymentStatus);
          const remaining = Math.max(0, request.totalAmount - request.paidAmount);
          const depositTone = request.status === "REJECTED" ? "bg-[#fff7df] text-[#805914]" : isDeposited ? "bg-[#edf9f2] text-[#16784a]" : "bg-[#fff7df] text-[#805914]";
          const depositText = request.status === "REJECTED"
            ? isDeposited ? "Đã nhận cọc · Chờ chuyển lịch hoặc hoàn cọc" : "Chưa nhận cọc · Không giữ chỗ"
            : isDeposited ? "Khoản cọc đã được đối soát" : `Chờ đối soát cọc ${formatMoney(request.depositAmount)}`;
          return (
            <article key={request.bookingCode} className="overflow-hidden rounded-2xl border border-[#d8b46a]/65 bg-white shadow-sm">
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold tracking-tight">{displayBookingCode(request.bookingCode)}</p><div className="mt-1 flex min-w-0 items-center justify-between gap-2"><p className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#d13f1f]"><Building2 size={11} /> {request.branchLabel}</p><p className="flex min-w-0 items-center justify-end gap-1 text-[10px] text-[#8a7a72]"><CalendarClock size={11} className="shrink-0" /><span className="truncate">{new Date(request.timeIso).toLocaleString("vi-VN", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</span></p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span></div>
                <div className="mt-3 space-y-2 rounded-xl bg-[#fffaf6] p-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold"><UserRound size={14} className="shrink-0 text-[#d13f1f]" /><span className="truncate">{request.customerName} · <span className="font-normal text-[#665b55]">{request.customerPhone}</span></span></p>
                  <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-[#665b55]"><CalendarClock size={13} className="shrink-0 text-[#d13f1f]" /><span className="truncate">{request.serviceLabel}</span></p>
                </div>
                {request.relationship === "BOSS" || request.relationship === "FRIEND" ? <div className={request.relationship === "BOSS" ? "mt-2 flex items-start gap-2 rounded-xl bg-[#30201c] p-2.5 text-white" : "mt-2 flex items-start gap-2 rounded-xl bg-[#fff2ef] p-2.5 text-[#6f211f]"}><Handshake size={14} className={request.relationship === "BOSS" ? "mt-0.5 shrink-0 text-[#f5d982]" : "mt-0.5 shrink-0 text-[#d13f1f]"} /><div><p className="text-[10px] font-bold uppercase tracking-wide">{request.relationship === "BOSS" ? "Khách mời sếp / đối tác" : "Khách đi cùng bạn"}</p><p className={request.relationship === "BOSS" ? "mt-1 text-[10px] leading-4 text-white/70" : "mt-1 text-[10px] leading-4 text-[#80524a]"}>{request.careNote ?? "Ưu tiên sắp xếp giường gần nhau và không gian phù hợp."}</p></div></div> : null}
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-xl border border-[#f0e3da] p-2"><span className="block text-[9px] text-[#8a7a72]">Tổng tiền</span><strong className="mt-0.5 block text-xs">{formatMoney(request.totalAmount)}</strong></div><div className="rounded-xl border border-[#d5eadc] bg-[#f3fbf6] p-2"><span className="block text-[9px] text-[#56806a]">Đã thu</span><strong className="mt-0.5 block text-xs text-[#16784a]">{formatMoney(request.paidAmount)}</strong></div><div className="rounded-xl border border-[#f0e3da] p-2"><span className="block text-[9px] text-[#8a7a72]">Còn lại</span><strong className="mt-0.5 block text-xs">{formatMoney(remaining)}</strong></div></div>
                <p className={`mt-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[10px] font-semibold ${depositTone}`}>{isDeposited ? <CheckCircle2 size={13} className="shrink-0" /> : <Banknote size={13} className="shrink-0" />} {depositText}</p>
                {request.status === "REJECTED" && request.rejectionReason ? <div className="mt-2 rounded-xl border border-[#f0c9c4] bg-[#fff8f7] p-2.5"><p className="text-[10px] font-semibold text-[#d13f1f]">Lý do đã gửi khách</p><p className="mt-1 text-[11px] leading-4 text-[#665b55]">{request.rejectionReason}</p></div> : null}
              </div>
              <div className="grid border-t border-[#eadbd1] bg-[#fffdfb] p-2.5">
                {request.rawStatus === "PENDING" ? <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setRejecting(request); setReason(QUICK_REASONS[0]); }} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d13f1f] px-3 py-2.5 text-xs font-semibold text-white"><XCircle size={14} /> Từ chối & lý do</button><button type="button" onClick={() => void confirm(request)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#16784a] px-3 py-2.5 text-xs font-semibold text-white"><Check size={14} /> Xác nhận lịch</button></div> : request.rawStatus === "CHECKED_IN" ? <button type="button" onClick={() => void transitionBooking(request, "IN_SERVICE")} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#2452b8] py-2.5 text-xs font-semibold text-white"><CheckCircle2 size={14} /> Xác nhận bắt đầu phục vụ</button> : request.rawStatus === "IN_SERVICE" ? request.paymentStatus === "PAID" ? <button type="button" onClick={() => void transitionBooking(request, "COMPLETED")} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#16784a] py-2.5 text-xs font-semibold text-white"><CheckCircle2 size={14} /> Hoàn tất dịch vụ & đóng Bill</button> : ["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(activeSession.role) ? <button type="button" onClick={() => setCollecting(request)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#805914] py-2.5 text-xs font-semibold text-white"><Banknote size={14} /> Đã thanh toán</button> : <p className="flex items-center justify-center gap-1.5 rounded-xl bg-[#fff7df] px-3 py-2.5 text-xs font-semibold text-[#805914]"><Banknote size={14} /> Chờ quầy đối soát đủ Bill</p> : request.rawStatus === "COMPLETED" ? <p className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-[#16784a]"><CheckCircle2 size={15} /> Dịch vụ và Bill đã hoàn tất</p> : request.status === "CONFIRMED" ? <p className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-[#16784a]"><CheckCircle2 size={15} /> Đã gửi xác nhận tới khách hàng</p> : <button type="button" onClick={() => setChat({ request, initialMessage: request.rejectionReason ?? "Tâm An xin phép hỗ trợ bạn đổi lịch." })} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#d13f1f] py-2.5 text-xs font-semibold text-[#d13f1f]"><MessageCircleMore size={15} /> Mở trao đổi với khách</button>}
              </div>
            </article>
          );
        })}
      </div>

      {selectedRegular.length === 0 && selectedBusiness.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-[#d8b46a] bg-white p-8 text-center text-xs text-[#8a7a72]">Ngày này chưa có Booking phù hợp cơ sở đang lọc.</div> : null}

      {rejectingBusiness ? (
        <div className="fixed inset-0 z-[75] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-5">
          <section className="w-full rounded-t-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1d8f55]">Tâm An Business</p><h2 className="mt-1 text-lg font-semibold">Từ chối lịch của {rejectingBusiness.companyName}</h2><p className="mt-1 text-[11px] leading-4 text-[#8a7a72]">Lý do sẽ được gửi tới khách và lưu nhật ký quản trị. Khoản cọc đã nhận sẽ được đưa vào luồng hoàn/đổi lịch.</p></div><button type="button" onClick={() => setRejectingBusiness(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff7ec]" aria-label="Đóng"><X size={17} /></button></div>
            <label className="mt-4 block text-xs font-semibold">Nội dung gửi khách<textarea value={businessReason} onChange={(event) => setBusinessReason(event.target.value)} rows={5} className="mt-1.5 w-full resize-none rounded-xl border border-[#eadbd1] p-3 text-sm leading-5" /></label>
            {actionError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{actionError}</p> : null}
            <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2"><button type="button" onClick={() => setRejectingBusiness(null)} className="rounded-full border border-[#eadbd1] py-2.5 text-xs font-semibold">Quay lại</button><button type="button" onClick={() => void rejectBusiness()} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d13f1f] py-2.5 text-xs font-semibold text-white"><XCircle size={14} /> Gửi & từ chối lịch</button></div>
          </section>
        </div>
      ) : null}
      {createOpen ? <ManualBookingDialog onClose={() => setCreateOpen(false)} /> : null}
      {rejecting ? <div className="fixed inset-0 z-[70] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-5"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d13f1f]">Phản hồi tế nhị</p><h2 className="mt-1 text-lg font-semibold">Từ chối lịch của {rejecting.customerName}</h2><p className="mt-1 text-[11px] text-[#8a7a72]">Chọn nhanh một lý do rồi điều chỉnh nếu cần.</p></div><button type="button" onClick={() => setRejecting(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff7ec]"><X size={17} /></button></div><div className="mt-4 space-y-2">{QUICK_REASONS.map((item) => <button key={item} type="button" onClick={() => setReason(item)} className={`w-full rounded-xl border p-3 text-left text-xs leading-5 ${reason === item ? "border-[#d13f1f] bg-[#fff2ef] text-[#7c171a]" : "border-[#eadbd1]"}`}>{item}</button>)}</div><label className="mt-3 block text-xs font-semibold">Nội dung gửi khách<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1.5 w-full resize-none rounded-xl border border-[#eadbd1] p-3 text-sm leading-5" /></label><div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2"><button type="button" onClick={() => setRejecting(null)} className="rounded-full border border-[#eadbd1] py-2.5 text-xs font-semibold">Quay lại</button><button type="button" onClick={rejectAndChat} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d13f1f] py-2.5 text-xs font-semibold text-white"><MessageCircleMore size={14} /> Gửi & mở Chat</button></div></section></div> : null}
      {chat ? <CustomerChat request={chat.request} initialMessage={chat.initialMessage} onClose={() => setChat(null)} /> : null}
      {collecting ? <CheckoutRecordDialog request={collecting} onClose={() => setCollecting(null)} onSaved={() => transitionBooking(collecting, "COMPLETED")} /> : null}
    </div>
  );
}
