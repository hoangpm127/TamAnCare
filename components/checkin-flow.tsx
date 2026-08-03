"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Hourglass,
  Loader2,
  LogOut,
  MapPin,
  PlayCircle,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useMembership } from "@/lib/membership";
import { QrScanner } from "@/components/qr-scanner";
import { customerAudienceHeaders } from "@/lib/request-audience";
import { suggestedTipForDuration } from "@/lib/tip-policy";
import { cn, formatMoney } from "@/lib/utils";
import { refreshWalletLedger } from "@/lib/wallet-ledger";

type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "IN_SERVICE";

type CheckinBooking = {
  bookingCode: string;
  branchId: string;
  branchLabel: string;
  serviceLabel: string;
  items: { name: string; qty: number; amount: number }[];
  therapistName: string;
  therapistIds: string[];
  timeLabel: string;
  durationMin: number;
  totalAmount: number;
  depositAmount: number;
  dueAmount: number;
  discount?: number;
  status: BookingStatus;
  paymentStatus: string;
  checkedInAt?: string | null;
  checkoutRequestedAt?: string | null;
  usedPackage: boolean;
  packageName?: string | null;
};

type Stage = "scan" | "options" | "detail";
type CheckinState = "idle" | "submitting";

function bookingStatus(status: BookingStatus) {
  if (status === "IN_SERVICE") return { label: "Đang phục vụ", className: "bg-[#fff4e6] text-[#ad432f]", icon: PlayCircle };
  if (status === "CHECKED_IN") return { label: "Đang phục vụ · đã nhận QR", className: "bg-[#fff4e6] text-[#ad432f]", icon: Hourglass };
  if (status === "PENDING") return { label: "Đã cọc · sẵn sàng dùng", className: "bg-[#fff7df] text-[#76551d]", icon: CreditCard };
  return { label: "Sẵn sàng sử dụng", className: "bg-[#eef5ff] text-[#28669b]", icon: CheckCircle2 };
}

function BillLines({ booking }: { booking: CheckinBooking }) {
  return (
    <div className="space-y-1.5 text-sm">
      {booking.items.map((item) => (
        <div key={`${booking.bookingCode}-${item.name}`} className="flex items-start justify-between gap-3 text-[#68574f]">
          <span className="min-w-0">{item.name}{item.qty > 1 ? ` x${item.qty}` : ""}</span>
          <span className="shrink-0 font-semibold text-[#281b18]">{booking.usedPackage ? "Lượt gói" : formatMoney(item.amount)}</span>
        </div>
      ))}
      {booking.discount && !booking.usedPackage ? <div className="flex items-center justify-between gap-3 font-medium text-[#a85f29]"><span>Ưu đãi</span><span>-{formatMoney(booking.discount)}</span></div> : null}
    </div>
  );
}

function ServiceTimer({
  startedAt,
  endedAt,
  durationMin,
  bookingCode,
  dueAmount,
  usedPackage,
}: {
  startedAt?: string | null;
  endedAt?: string | null;
  durationMin: number;
  bookingCode: string;
  dueAmount: number;
  usedPackage: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endedAt]);

  const timerEnd = endedAt ? new Date(endedAt).getTime() : now;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((timerEnd - new Date(startedAt).getTime()) / 1000)) : 0;
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const elapsed = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  const plannedSeconds = Math.max(1, durationMin * 60);
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
  const remainingSecondsPart = remainingSeconds % 60;
  const remaining = [remainingHours, remainingMinutes, remainingSecondsPart].map((value) => String(value).padStart(2, "0")).join(":");
  const progress = Math.min(100, Math.round((elapsedSeconds / plannedSeconds) * 100));
  const suggestedTip = suggestedTipForDuration(durationMin);

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#4c191b] via-[#ad432f] to-[#a85f29] p-4 text-center text-white shadow-lg shadow-[#ad432f]/20">
      <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"><Hourglass className={endedAt ? "" : "animate-pulse"} size={14} /> {endedAt ? "Đồng hồ đã dừng" : "Dịch vụ đang được tính giờ"}</p>
      <p className="mt-2 font-mono text-4xl font-bold tracking-wider tabular-nums">{elapsed}</p>
      <p className="mt-1 text-[10px] font-medium text-white/75">Thời gian đã phục vụ</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#e7c878] transition-all duration-1000" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-white/80"><span>Dự kiến {durationMin} phút</span><span>{remainingSeconds > 0 ? `Còn ${remaining}` : "Đã đủ thời lượng"}</span></div>
      <p className="mt-3 border-t border-white/15 pt-2 text-[10px] leading-4 text-white/70">{endedAt ? "Thời lượng thực tế đã được khóa theo yêu cầu check-out sớm và gửi tới cơ sở/KTV." : "Đồng hồ bắt đầu từ lúc xác nhận “Sử dụng dịch vụ” và dừng khi cơ sở/KTV check-out."}</p>
      {!endedAt && remainingSeconds > 0 && suggestedTip > 0 ? (
        <div className="mt-2 rounded-xl border border-[#e7c878]/25 bg-white/10 px-3 py-2.5 text-left">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#fff1b8]"><Sparkles size={12} /> Một lời cảm ơn dành cho KTV</p>
          <p className="mt-1 text-center text-[10px] leading-4 text-white/90">Tâm An trân trọng gợi ý mức Tip từ <strong className="text-[#fff1b8]">{formatMoney(suggestedTip)}</strong> cho ca {durationMin} phút. Nếu bạn hài lòng với sự tận tâm của KTV, một mức Tip cao hơn sẽ là sự động viên rất ý nghĩa.</p>
          <p className="mt-1 text-center text-[9px] leading-4 text-white/65">Tip được trao trực tiếp cho KTV, tách riêng và không cộng vào Bill thanh toán cho cơ sở.</p>
        </div>
      ) : null}
      {!endedAt && remainingSeconds === 0 ? (
        <div className="mt-3 rounded-2xl bg-white p-3.5 text-[#281b18] shadow-lg">
          <BellRing className="mx-auto text-[#c64b32]" size={22} />
          <p className="mt-2 text-sm font-semibold">Liệu trình đã đủ thời lượng</p>
          <p className="mt-1 text-[10px] leading-4 text-[#68574f]">Mời bạn thư giãn trong lúc KTV hỗ trợ kết thúc liệu trình và quầy kiểm tra trạng thái dịch vụ.</p>
          {usedPackage ? (
            <p className="mt-3 rounded-xl bg-[#fff7df] px-3 py-2 text-[10px] font-medium text-[#76551d]">Lượt gói đã được thanh toán trước; quầy chỉ xác nhận hoàn tất và lưu lịch sử sử dụng.</p>
          ) : (
            <div className="mt-3 rounded-xl bg-[#fbf2e7] p-3 text-left">
              <p className="flex items-center justify-between text-[10px] text-[#826f66]"><span>Phần Bill còn lại</span><strong className="text-sm text-[#c64b32]">{formatMoney(dueAmount)}</strong></p>
              <Link href={`/thanh-toan/${encodeURIComponent(bookingCode)}`} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-4 py-2.5 text-xs font-semibold text-white"><Receipt size={14} /> Mở Bill thanh toán tại quầy</Link>
            </div>
          )}
          <p className="mt-2 text-[9px] leading-4 text-[#826f66]">Tip được trao trực tiếp cho KTV và luôn tách khỏi Bill của cơ sở.</p>
        </div>
      ) : null}
    </div>
  );
}

export function CheckinFlow({
  branches,
  initialBookingCode,
  initialBranchId,
  initialTherapist,
}: {
  branches: { id: string; label: string }[];
  initialBookingCode?: string;
  initialBranchId?: string;
  initialTherapist?: { id: string; branchId: string; name: string };
}) {
  const membership = useMembership();
  const [bookings, setBookings] = useState<CheckinBooking[]>([]);
  const [stage, setStage] = useState<Stage>("scan");
  const [scannedBranchId, setScannedBranchId] = useState<string | null>(null);
  const [scannedTherapistId, setScannedTherapistId] = useState<string | null>(initialTherapist?.id ?? null);
  const [selectedBookingCode, setSelectedBookingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [scanError, setScanError] = useState("");
  const [checkinState, setCheckinState] = useState<CheckinState>("idle");
  const [checkoutState, setCheckoutState] = useState<CheckinState>("idle");
  const [showEarlyCheckoutConfirm, setShowEarlyCheckoutConfirm] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  const didOpenInitialBooking = useRef(false);
  const didAutoStartTherapistQr = useRef(false);

  const loadBookings = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams({ limit: initialBookingCode ? "1" : "100" });
      query.set("audience", "customer");
      if (initialBookingCode) query.set("referenceCode", initialBookingCode);
      const response = await fetch(`/api/bookings?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Hãy đăng nhập nếu bạn đang dùng thiết bị khác với thiết bị đã đặt lịch." : data.error ?? "Không thể tải booking.");
      const mapped = (data.bookings ?? [])
        .filter((item: { status: string; paymentStatus: string; timeIso?: string }) => (
          ["CONFIRMED", "CHECKED_IN", "IN_SERVICE"].includes(item.status)
        ) && item.timeIso)
        .map((item: { referenceCode: string; branchId: string; branchLabel: string; serviceLabel: string; items: { name: string; qty: number; amount: number; subtotalAmount?: number }[]; therapistName: string; therapistIds?: string[]; timeIso: string; durationMin: number; totalAmount: number; depositAmount: number; dueAmount: number; discountAmount: number; status: BookingStatus; paymentStatus: string; checkedInAt?: string | null; checkoutRequestedAt?: string | null; usedPackage?: boolean; packageName?: string | null }) => ({
          bookingCode: item.referenceCode,
          branchId: item.branchId,
          branchLabel: item.branchLabel,
          serviceLabel: item.serviceLabel,
          items: item.items.map((line) => ({ ...line, amount: line.subtotalAmount ?? line.amount })),
          therapistName: item.therapistName,
          therapistIds: item.therapistIds ?? [],
          timeLabel: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(item.timeIso)),
          durationMin: item.durationMin,
          totalAmount: item.totalAmount,
          depositAmount: item.depositAmount,
          dueAmount: item.dueAmount,
          discount: item.discountAmount || undefined,
          status: item.status,
          paymentStatus: item.paymentStatus,
          checkedInAt: item.checkedInAt,
          checkoutRequestedAt: item.checkoutRequestedAt,
          usedPackage: Boolean(item.usedPackage),
          packageName: item.packageName,
        }));
      setBookings(mapped);
      const initialBooking = initialBookingCode ? mapped[0] : null;
      if (!didOpenInitialBooking.current && initialBooking && ["CHECKED_IN", "IN_SERVICE"].includes(initialBooking.status)) {
        didOpenInitialBooking.current = true;
        setScannedBranchId(initialBooking.branchId);
        setSelectedBookingCode(initialBooking.bookingCode);
        setStage("detail");
      }
      if (initialTherapist) {
        const therapistBooking = mapped.find((item: CheckinBooking) => item.therapistIds.includes(initialTherapist.id));
        if (!didOpenInitialBooking.current) {
          didOpenInitialBooking.current = true;
          setScannedBranchId(initialTherapist.branchId);
          setScannedTherapistId(initialTherapist.id);
        }
        if (therapistBooking && !selectedBookingCode) {
          setSelectedBookingCode(therapistBooking.bookingCode);
          setStage("detail");
          setAccessError("");
        } else if (!therapistBooking) {
          setStage("options");
          setAccessError(`Chưa có Bill đủ điều kiện với KTV ${initialTherapist.name} trên tài khoản/thiết bị này.`);
        }
      } else if (initialBranchId && !didOpenInitialBooking.current) {
        didOpenInitialBooking.current = true;
        setScannedBranchId(initialBranchId);
        setScannedTherapistId(null);
        setSelectedBookingCode(null);
        setStage("options");
        setAccessError("");
      } else {
        setAccessError("");
      }
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : "Không thể tải booking.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [initialBookingCode, initialBranchId, initialTherapist, selectedBookingCode]);

  useEffect(() => { queueMicrotask(() => void loadBookings()); }, [loadBookings]);
  useEffect(() => {
    if (stage === "scan") return;
    const timer = window.setInterval(() => void loadBookings(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadBookings, stage]);

  const selectedBooking = useMemo(
    () => bookings.find((item) => item.bookingCode === selectedBookingCode) ?? null,
    [bookings, selectedBookingCode]
  );
  const branchBookings = bookings.filter((item) => item.branchId === scannedBranchId && (!scannedTherapistId || item.therapistIds.includes(scannedTherapistId)));
  const scannedBranchLabel = branches.find((item) => item.id === scannedBranchId)?.label ?? "cơ sở này";

  function handleScanned(raw: string) {
    try {
      const url = new URL(raw, window.location.origin);
      const careQr = url.origin === window.location.origin
        && url.pathname === "/check-in"
        && Boolean(url.searchParams.get("venue") || url.searchParams.get("ktv"));
      const businessQr = url.origin === window.location.origin && url.pathname.startsWith("/business/scan/");
      if (careQr || businessQr) {
        setScanError("");
        window.location.assign(url.toString());
        return;
      }
    } catch {
      // Hiển thị thông báo thống nhất phía dưới khi dữ liệu không phải URL hợp lệ.
    }
    setScanError("Mã QR chưa được nhận diện. Vui lòng đưa đúng mã QR Tâm An Center vào giữa khung.");
  }

  const startService = useCallback(async () => {
    if (!selectedBooking) return;
    setCheckinState("submitting");
    setCheckinError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(selectedBooking.bookingCode)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...customerAudienceHeaders },
        body: JSON.stringify({ status: "IN_SERVICE", venueBranchId: scannedBranchId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể bắt đầu tính giờ dịch vụ.");
      setBookings((items) => items.map((item) => item.bookingCode === selectedBooking.bookingCode ? { ...item, status: "IN_SERVICE", checkedInAt: item.checkedInAt ?? new Date().toISOString() } : item));
      await Promise.all([loadBookings(true), refreshWalletLedger(true)]);
    } catch (reason) {
      setCheckinError(reason instanceof Error ? reason.message : "Không thể bắt đầu tính giờ dịch vụ.");
    } finally {
      setCheckinState("idle");
    }
  }, [loadBookings, scannedBranchId, selectedBooking]);

  async function requestEarlyCheckout() {
    if (!selectedBooking) return;
    setCheckoutState("submitting");
    setCheckinError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(selectedBooking.bookingCode)}/checkout-request`, {
        method: "POST",
        headers: customerAudienceHeaders,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể ghi nhận check-out sớm.");
      setBookings((items) => items.map((item) => item.bookingCode === selectedBooking.bookingCode
        ? { ...item, checkoutRequestedAt: payload.checkoutRequestedAt }
        : item));
      setShowEarlyCheckoutConfirm(false);
      await Promise.all([loadBookings(true), refreshWalletLedger(true)]);
    } catch (reason) {
      setCheckinError(reason instanceof Error ? reason.message : "Không thể ghi nhận check-out sớm.");
    } finally {
      setCheckoutState("idle");
    }
  }

  useEffect(() => {
    if (!initialTherapist || !selectedBooking || didAutoStartTherapistQr.current) return;
    if (selectedBooking.status !== "CONFIRMED") return;
    didAutoStartTherapistQr.current = true;
    queueMicrotask(() => void startService());
  }, [initialTherapist, selectedBooking, startService]);

  if (loading) {
    return <section className="flex items-center justify-center rounded-2xl border border-[#e7d6ca] bg-white p-10 text-sm text-[#68574f]"><Loader2 className="mr-2 animate-spin text-[#c64b32]" size={18} /> Đang xác thực Bill và thẻ của bạn…</section>;
  }

  if (stage === "detail" && selectedBooking) {
    const status = selectedBooking.checkoutRequestedAt
      ? { label: "Đã yêu cầu check-out sớm", className: "bg-[#fff7df] text-[#76551d]", icon: CheckCircle2 }
      : bookingStatus(selectedBooking.status);
    const StatusIcon = status.icon;
    return (
      <div className="space-y-3">
        <div className={cn("flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold", status.className)}>
          <span className="inline-flex items-center gap-1.5"><StatusIcon size={16} /> {status.label}</span>
          <button type="button" onClick={() => void loadBookings(true)} className="inline-flex items-center gap-1"><RefreshCw size={13} /> Cập nhật</button>
        </div>
        <section className="rounded-2xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#c64b32]"><Receipt size={13} /> {selectedBooking.checkoutRequestedAt ? (selectedBooking.usedPackage ? "Lượt gói chờ hoàn tất" : "Bill chờ hoàn tất") : ["CHECKED_IN", "IN_SERVICE"].includes(selectedBooking.status) ? (selectedBooking.usedPackage ? "Lượt gói đang sử dụng" : "Bill đang sử dụng") : (selectedBooking.usedPackage ? "Lượt gói đã giữ" : "Bill chưa sử dụng")}</p><h2 className="mt-1 text-base font-semibold">{selectedBooking.serviceLabel}</h2></div>
            {selectedBooking.usedPackage ? <span className="shrink-0 rounded-full bg-[#fff7df] px-2 py-1 text-[10px] font-semibold text-[#76551d]">Đã trả trước</span> : null}
          </div>
          <div className="mt-3"><BillLines booking={selectedBooking} /></div>
          {selectedBooking.usedPackage ? (
            <div className="mt-3 rounded-xl bg-[#fbf2e7] p-3 text-xs leading-5 text-[#715943]"><CreditCard className="mr-1 inline text-[#c64b32]" size={14} /> Sử dụng thẻ <strong>{selectedBooking.packageName ?? "dài hạn"}</strong>. Check-out chỉ trừ lượt và tạo lịch sử; không thu lại tiền dịch vụ.</div>
          ) : (
            <>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#e7d6ca] pt-3 font-semibold"><span>Tổng dịch vụ</span><span className="text-[#c64b32]">{formatMoney(selectedBooking.totalAmount)}</span></div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-[#826f66]"><span>Đã đặt cọc</span><span className="font-semibold text-[#a85f29]">-{formatMoney(selectedBooking.depositAmount)}</span></div>
              <div className="mt-1 flex items-center justify-between text-xs text-[#826f66]"><span>Còn lại sau dịch vụ</span><span className="font-semibold text-[#51423b]">{formatMoney(selectedBooking.dueAmount)}</span></div>
            </>
          )}
          <div className="mt-4 space-y-1.5 border-t border-dashed border-[#e7d6ca] pt-3 text-xs text-[#68574f]">
            <p className="flex items-center gap-1.5"><Clock size={13} className="text-[#c64b32]" /> {selectedBooking.timeLabel}</p>
            <p className="flex items-center gap-1.5"><UserRound size={13} className="text-[#c64b32]" /> {selectedBooking.therapistName}</p>
            <p className="flex items-center gap-1.5"><MapPin size={13} className="text-[#c64b32]" /> {selectedBooking.branchLabel}</p>
          </div>

          {selectedBooking.status === "CONFIRMED" ? (
            <button type="button" onClick={() => void startService()} disabled={checkinState === "submitting"} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {checkinState === "submitting" ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {checkinState === "submitting" ? "Đang bắt đầu tính giờ…" : "Sử dụng dịch vụ"}
            </button>
          ) : null}
          {["CHECKED_IN", "IN_SERVICE"].includes(selectedBooking.status) ? <div className="mt-4"><ServiceTimer startedAt={selectedBooking.checkedInAt} endedAt={selectedBooking.checkoutRequestedAt} durationMin={selectedBooking.durationMin} bookingCode={selectedBooking.bookingCode} dueAmount={selectedBooking.dueAmount} usedPackage={selectedBooking.usedPackage} /></div> : null}
          {["CHECKED_IN", "IN_SERVICE"].includes(selectedBooking.status) && !selectedBooking.checkoutRequestedAt ? (
            <button type="button" onClick={() => setShowEarlyCheckoutConfirm(true)} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#c64b32] bg-white px-4 py-2.5 text-xs font-semibold text-[#c64b32]">
              <LogOut size={14} /> Check-out sớm
            </button>
          ) : null}
          {showEarlyCheckoutConfirm && !selectedBooking.checkoutRequestedAt ? (
            <div className="mt-3 rounded-2xl border border-[#e8d39e] bg-[#fffaf0] p-3.5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#4d3218]">Xác nhận check-out sớm?</p><p className="mt-1 text-[11px] leading-5 text-[#715943]">Đồng hồ sẽ dừng ngay và gửi thời gian thực tế cho quầy/KTV. Giá Bill hoặc lượt gói không tự giảm; cơ sở sẽ đối soát theo chính sách trước khi hoàn tất.</p></div><button type="button" onClick={() => setShowEarlyCheckoutConfirm(false)} aria-label="Đóng xác nhận check-out sớm" className="rounded-full bg-white p-1.5 text-[#826f66]"><X size={14} /></button></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowEarlyCheckoutConfirm(false)} className="rounded-full border border-[#d9c8bc] bg-white px-3 py-2.5 text-xs font-semibold text-[#68574f]">Tiếp tục dịch vụ</button><button type="button" onClick={() => void requestEarlyCheckout()} disabled={checkoutState === "submitting"} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-60">{checkoutState === "submitting" ? <Loader2 className="animate-spin" size={13} /> : <LogOut size={13} />} {checkoutState === "submitting" ? "Đang ghi nhận…" : "Xác nhận check-out"}</button></div>
            </div>
          ) : null}
          {selectedBooking.checkoutRequestedAt ? (
            <div className="mt-3 rounded-2xl bg-[#fff7df] p-3.5 text-center text-xs leading-5 text-[#76551d]"><CheckCircle2 className="mx-auto mb-1" size={18} /><strong>Đã dừng giờ và báo cho cơ sở/KTV.</strong><br />Quầy đang kiểm tra thời lượng, thanh toán và xác nhận đóng Bill.{!selectedBooking.usedPackage ? <Link href={`/thanh-toan/${encodeURIComponent(selectedBooking.bookingCode)}`} className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#c64b32] px-4 py-2.5 font-semibold text-white">Thanh toán phần còn lại</Link> : null}</div>
          ) : null}
          {checkinError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{checkinError}</p> : null}
          <div className="mt-3 rounded-xl bg-[#f8f4f1] p-3 text-[10px] leading-4 text-[#68574f]"><ShieldCheck className="mr-1 inline text-[#a85f29]" size={13} /> Mỗi lần chuyển trạng thái đều được lưu lịch sử và gửi thông báo hai chiều cho khách, cơ sở và KTV phụ trách.</div>
          <button type="button" onClick={() => { setStage("options"); setSelectedBookingCode(null); setShowEarlyCheckoutConfirm(false); }} className="mt-3 w-full text-center text-xs font-semibold text-[#826f66]">Chọn Bill/thẻ khác</button>
        </section>
      </div>
    );
  }

  if (stage === "options") {
    const therapistQuery = scannedTherapistId ? `&therapist=${encodeURIComponent(scannedTherapistId)}` : "";
    const packageBookingHref = membership?.serviceId
      ? `/booking?service=${encodeURIComponent(membership.serviceId)}&branch=${encodeURIComponent(scannedBranchId ?? "")}&source=Venue-QR${therapistQuery}`
      : `/booking?branch=${encodeURIComponent(scannedBranchId ?? "")}&source=Venue-QR${therapistQuery}`;
    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4e6] text-[#a85f29]">{scannedTherapistId ? <UserRound size={18} /> : <MapPin size={18} />}</span><div><p className="text-xs text-[#826f66]">{scannedTherapistId ? "Đã nhận diện QR KTV" : "Đã nhận diện địa điểm"}</p><h2 className="text-base font-semibold">{scannedTherapistId ? `${initialTherapist?.name ?? "KTV Tâm An"} · ${scannedBranchLabel}` : scannedBranchLabel}</h2></div></div>
          <p className="mt-3 text-xs leading-5 text-[#68574f]">{scannedTherapistId ? "Hệ thống chỉ hiển thị Bill đã phân công đúng KTV này. Chọn Bill để bắt đầu hoặc xem ngay đồng hồ phục vụ." : "Chọn Bill hoặc lượt thẻ bạn muốn sử dụng. Hệ thống chỉ hiển thị quyền sử dụng đã được xác thực trên tài khoản hoặc thiết bị này."}</p>
        </section>

        {branchBookings.length ? <div className="space-y-2">{branchBookings.map((booking) => {
          const status = bookingStatus(booking.status);
          const StatusIcon = status.icon;
          return <button key={booking.bookingCode} type="button" onClick={() => { setSelectedBookingCode(booking.bookingCode); setStage("detail"); }} className="flex w-full items-center gap-3 rounded-2xl border border-[#e7d6ca] bg-white p-3.5 text-left shadow-sm"><span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", booking.usedPackage ? "bg-[#fff7df] text-[#76551d]" : "bg-[#f8ebe5] text-[#c64b32]")}>{booking.usedPackage ? <CreditCard size={19} /> : <Receipt size={19} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{booking.serviceLabel}</span><span className="mt-0.5 block truncate text-[11px] text-[#826f66]">{booking.timeLabel} · {booking.therapistName}</span><span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold", status.className)}><StatusIcon size={10} /> {status.label}</span></span><ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" /></button>;
        })}</div> : null}

        {membership ? (
          <section className="rounded-2xl bg-gradient-to-br from-[#231514] to-[#4a281a] p-4 text-white shadow-sm">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#e7c878]"><CreditCard size={20} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c59a3d]">Thẻ dùng chung cả 2 cơ sở</p><h3 className="mt-0.5 truncate text-sm font-semibold">{membership.planName}</h3><p className="mt-1 text-xs text-white/70">Còn {membership.availableSessions} lượt khả dụng · HSD {membership.expiresAt}</p></div></div>
            <p className="mt-3 text-[11px] leading-5 text-white/70">Nếu chưa có lịch đã giữ ở {scannedBranchLabel}, hãy chọn dịch vụ/giờ/KTV. Hệ thống tự nhận lượt gói và không yêu cầu đặt cọc.</p>
            <Link href={packageBookingHref} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#e7c878] px-4 py-2.5 text-xs font-semibold text-[#4a2d16]">Đặt nhanh bằng lượt gói <ChevronRight size={14} /></Link>
          </section>
        ) : null}

        {!branchBookings.length && !membership ? <section className="rounded-2xl border border-dashed border-[#e7d6ca] bg-white p-6 text-center"><p className="text-sm leading-6 text-[#68574f]">Chưa tìm thấy Bill chưa sử dụng hoặc thẻ dài hạn còn hiệu lực tại {scannedBranchLabel}.</p>{accessError ? <p className="mt-2 text-xs text-[#c64b32]">{accessError}</p> : null}<div className="mt-4 flex justify-center gap-2"><Link href="/tai-khoan" className="rounded-full border border-[#c64b32] px-4 py-2.5 text-xs font-semibold text-[#c64b32]">Đăng nhập khôi phục</Link><Link href={`/booking?branch=${encodeURIComponent(scannedBranchId ?? "")}${therapistQuery}`} className="rounded-full bg-[#c64b32] px-4 py-2.5 text-xs font-semibold text-white">Đặt lịch mới</Link></div></section> : null}
        <button type="button" onClick={() => setStage("scan")} className="w-full text-center text-xs font-semibold text-[#c64b32]">Quét QR cơ sở khác</button>
      </div>
    );
  }

  return (
    <section>
      <div className="rounded-2xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
        <p className="mb-1 flex items-center justify-center gap-2 text-sm font-semibold"><Camera size={16} className="text-[#c64b32]" /> Đưa mã QR vào giữa khung</p>
        <p className="mb-3 text-center text-[10px] leading-4 text-[#826f66]">Quét mã tại cơ sở, trên thiết bị KTV hoặc KTV Business trưởng.</p>
        <QrScanner onScanned={handleScanned} />
        <p className="mt-3 text-center text-xs leading-5 text-[#826f66]">Hệ thống sẽ tự mở đúng lịch hoặc thẻ đủ điều kiện để bạn bắt đầu sử dụng dịch vụ.</p>
        {scanError ? <p className="mt-2 rounded-xl bg-[#fff7df] p-2.5 text-center text-xs text-[#76551d]">{scanError}</p> : null}
      </div>
    </section>
  );
}
