"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import { customerAudienceHeaders } from "@/lib/request-audience";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";

type Stage = "pick" | "deposit" | "confirming" | "done";
type ReschedulePayment = { id: string; status: string; amount: number; paymentCode?: string | null };

type AccessibleBooking = {
  referenceCode: string;
  branchId: string;
  serviceId: string;
  serviceLabel: string;
  therapistName: string;
  totalAmount: number;
  depositAmount: number;
  timeIso: string;
  rescheduleCount: number;
};

export function RescheduleAccessClient({ bookingCode }: { bookingCode: string }) {
  const [booking, setBooking] = useState<AccessibleBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ referenceCode: bookingCode, limit: "1" });
    fetch(`/api/bookings?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? "Phiên xem booking đã hết hạn. Hãy đăng nhập để khôi phục lịch." : payload.error ?? "Không thể mở booking.");
        return payload.bookings?.[0] as AccessibleBooking | undefined;
      })
      .then((item) => {
        if (!active) return;
        if (!item?.serviceId || !item.timeIso) throw new Error("Booking không còn đủ thông tin để đổi lịch.");
        setBooking(item);
      })
      .catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : "Không thể mở booking."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingCode]);

  if (loading) return <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#fffaf6]"><Loader2 className="mr-2 animate-spin text-[#d13f1f]" size={18} /> Đang xác thực booking…</main>;
  if (!booking || loadError) return <main className="mx-auto max-w-xl px-4 py-10"><section className="rounded-2xl border border-[#eadbd1] bg-white p-6 text-center"><AlertTriangle className="mx-auto text-[#d13f1f]" /><h1 className="mt-3 text-lg font-semibold">Không thể mở yêu cầu đổi lịch</h1><p className="mt-2 text-sm leading-6 text-[#665b55]">{loadError || "Booking không tồn tại."}</p><Link href="/tai-khoan" className="mt-4 inline-flex rounded-full bg-[#d13f1f] px-5 py-2.5 text-sm font-semibold text-white">Đăng nhập tài khoản</Link></section></main>;

  return <RescheduleClient
    bookingCode={booking.referenceCode}
    branchId={booking.branchId}
    serviceId={booking.serviceId}
    serviceName={booking.serviceLabel}
    therapistName={booking.therapistName}
    totalAmount={booking.totalAmount}
    depositAmount={booking.depositAmount}
    currentStartTimeIso={booking.timeIso}
    initialRescheduleCount={booking.rescheduleCount}
  />;
}

export function RescheduleClient({
  bookingCode,
  branchId,
  serviceId,
  serviceName,
  therapistName,
  totalAmount,
  depositAmount,
  currentStartTimeIso,
  initialRescheduleCount,
}: {
  bookingCode: string;
  branchId: string;
  serviceId: string;
  serviceName: string;
  therapistName: string;
  totalAmount: number;
  depositAmount: number;
  currentStartTimeIso: string;
  initialRescheduleCount: number;
}) {
  const isFreeReschedule = initialRescheduleCount === 0;
  const currentStart = parseISO(currentStartTimeIso);

  const [stage, setStage] = useState<Stage>("pick");
  const [newDate, setNewDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [newTime, setNewTime] = useState("");
  const [acceptedDepositPolicy, setAcceptedDepositPolicy] = useState(false);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [error, setError] = useState("");
  const [reschedulePayment, setReschedulePayment] = useState<ReschedulePayment | null>(null);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ serviceId, branchId, date: newDate });
    fetch(`/api/availability?${query}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const next = (data.slots ?? []).map((slot: { startTime: string }) => slot.startTime.slice(11, 16));
        setTimeSlots(next);
        setNewTime((current) => next.includes(current) ? current : next[0] ?? "");
      })
      .catch(() => { if (active) setTimeSlots([]); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [branchId, newDate, serviceId]);

  const finalizeReschedule = useCallback(() => {
    setStage("done");
  }, []);

  async function submitReschedule() {
    if (!newTime) return;
    setError("");
    setStage("confirming");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingCode)}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...customerAudienceHeaders },
        body: JSON.stringify({ newStartTime: `${newDate}T${newTime}:00+07:00` }),
      });
      const data = await response.json();
      if (response.status === 402 && data.requiresPayment) {
        setReschedulePayment(data.payment as ReschedulePayment);
        setStage("deposit");
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Không thể đổi lịch.");
      finalizeReschedule();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi lịch.");
      setStage("pick");
    }
  }

  function confirmSchedule() {
    if (!isFreeReschedule && !acceptedDepositPolicy) return;
    void submitReschedule();
  }

  function confirmDeposit() {
    setError("");
    setStage("confirming");
  }

  useEffect(() => {
    if (stage !== "confirming" || !reschedulePayment) return;
    let active = true;
    async function reconcileAndApply() {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingCode)}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...customerAudienceHeaders },
        body: JSON.stringify({ newStartTime: `${newDate}T${newTime}:00+07:00` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!active) return;
      if (response.status === 402 && data.requiresPayment) {
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Không thể hoàn tất đổi lịch.");
        setStage("deposit");
        return;
      }
      finalizeReschedule();
    }
    queueMicrotask(() => void reconcileAndApply());
    const timer = window.setInterval(reconcileAndApply, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [bookingCode, finalizeReschedule, newDate, newTime, reschedulePayment, stage]);

  if (stage === "done") {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-[#eadbd1] bg-white shadow-lg">
          <div className="bg-gradient-to-br from-[#b86b1f] via-[#8f151a] to-[#4d0c10] px-6 pb-7 pt-6 text-center text-white">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 size={26} />
            </span>
            <h1 className="mt-3 text-lg font-semibold tracking-tight">Đã đổi lịch thành công!</h1>
          </div>
          <div className="space-y-2 px-6 py-6 text-sm text-[#4d403a]">
            <p>
              {serviceName} · {therapistName}
            </p>
            <p className="flex items-center gap-1.5 font-semibold text-[#191414]">
              <Calendar size={14} className="text-[#d13f1f]" /> {newTime}, ngày {format(parseISO(newDate), "dd/MM/yyyy")}
            </p>
            {!isFreeReschedule ? (
              <p className="rounded-xl bg-[#fff2ef] p-3 text-xs leading-5 text-[#d13f1f]">
                Cọc mới {formatMoney(depositAmount)} đã được ghi nhận cho lịch hẹn mới.
              </p>
            ) : (
              <p className="rounded-xl bg-[#fff4e6] p-3 text-xs leading-5 text-[#1d6c40]">
                Đây là lượt đổi lịch miễn phí đầu tiên của bạn cho đơn này — không mất phí.
              </p>
            )}
            <Link
              href="/don-cua-toi?tab=upcoming"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white"
            >
              Xem lịch đã đặt
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "confirming") {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="flex flex-col items-center gap-2.5 rounded-2xl border border-[#e3b23c] bg-[#fff7ec] p-10 text-center">
          <Loader2 className="animate-spin text-[#d13f1f]" size={28} />
          <p className="text-sm font-semibold text-[#5c3a1e]">{reschedulePayment ? "Đang chờ đối soát cọc mới..." : "Đang kiểm tra lịch trống và cập nhật booking..."}</p>
          <p className="text-xs text-[#8a7a72]">{reschedulePayment ? "Lịch chỉ được thay sau khi webhook ngân hàng xác nhận." : "Hệ thống đang khóa KTV và ghế/giường phù hợp."}</p>
        </section>
      </main>
    );
  }

  if (stage === "deposit") {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="rounded-2xl border border-[#e3b23c] bg-[#fff7ec] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#5c3a1e]">
            <ShieldCheck size={16} className="shrink-0" /> Đặt cọc lại {formatMoney(depositAmount)}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-[#8a7a72]">
            Chuyển khoản đúng số tiền để giữ lịch mới: {newTime}, ngày {format(parseISO(newDate), "dd/MM/yyyy")}.
          </p>
          <BankTransferDetails
            amount={depositAmount}
            transferContent={reschedulePayment?.paymentCode ?? `${displayBookingCode(bookingCode)}-DL`}
            onConfirm={confirmDeposit}
            confirmLabel="Tôi đã thực hiện chuyển khoản"
            helperText="SePay sẽ xác nhận cọc mới trước khi hệ thống thay lịch cũ."
          />
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-[#191414] sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Đổi lịch hẹn</h1>
      <p className="mt-1 text-sm text-[#665b55]">
        {serviceName} · {therapistName} · Tổng {formatMoney(totalAmount)}
      </p>
      <p className="mt-0.5 text-sm text-[#665b55]">Lịch hiện tại: {format(currentStart, "HH:mm dd/MM/yyyy")}</p>

      {isFreeReschedule ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#eadbd1] bg-white p-3.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#1d6c40]" />
          <p className="text-xs leading-5 text-[#4d403a]">
            Bạn được đổi lịch <strong>miễn phí 1 lần</strong> cho đơn này. Từ lần đổi lịch thứ 2 trở đi, tiền cọc đã đặt sẽ không được
            hoàn lại và bạn cần đặt cọc lại để giữ lịch mới.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#e3b23c] bg-[#fff7ec] p-3.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#d13f1f]" />
          <p className="text-xs leading-5 text-[#5c3a1e]">
            Bạn đã dùng lượt đổi lịch miễn phí cho đơn này. Đổi lịch lần này, tiền cọc {formatMoney(depositAmount)} đã đặt trước đó sẽ{" "}
            <strong>được tính vào chi phí giữ khung giờ cũ</strong>, và bạn cần đặt cọc lại {formatMoney(depositAmount)} để giữ lịch mới.
            Bạn không phải đặt lại dịch vụ; hệ thống sẽ tự thay lịch sau khi nhận cọc mới.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[#f1e1d4] bg-white p-4 shadow-sm">
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Calendar size={16} /> Chọn lịch mới
        </h2>
        <label className="block">
          <span className="text-xs font-semibold">Ngày mới</span>
          <input
            type="date"
            value={newDate}
            onChange={(event) => {
              setLoadingSlots(true);
              setNewDate(event.target.value);
            }}
            min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
            className="mt-1.5 w-full rounded-lg border border-[#eadbd1] px-3 py-2.5 text-sm"
          />
        </label>
        <p className="mb-2 mt-3 text-xs font-semibold">Khung giờ mới</p>
        <div className="grid grid-cols-3 gap-2">
          {loadingSlots ? <p className="col-span-3 flex items-center justify-center gap-2 py-4 text-xs text-[#8a7a72]"><Loader2 className="animate-spin" size={14} /> Đang tải lịch trống thật...</p> : timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setNewTime(time)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold transition",
                newTime === time ? "border-[#d13f1f] bg-[#fff2ef] text-[#d13f1f]" : "border-[#eadbd1] bg-white text-[#4d403a]"
              )}
            >
              <Clock size={11} /> {time}
            </button>
          ))}
          {!loadingSlots && timeSlots.length === 0 ? <p className="col-span-3 rounded-xl bg-[#fff7ec] p-3 text-center text-xs text-[#805914]">Ngày này chưa còn khung giờ phù hợp.</p> : null}
        </div>

        {!isFreeReschedule ? (
          <button
            type="button"
            onClick={() => setAcceptedDepositPolicy((value) => !value)}
            className="mt-3 flex w-full items-start gap-2.5 rounded-xl border border-[#eadbd1] bg-[#fffaf6] p-3 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                acceptedDepositPolicy ? "border-[#d13f1f] bg-[#d13f1f] text-white" : "border-[#c9b6ac] bg-white"
              )}
            >
              {acceptedDepositPolicy ? <Check size={11} /> : null}
            </span>
            <span className="text-[11px] leading-5 text-[#665b55]">
              Tôi đã hiểu chính sách đổi lịch từ lần thứ 2 và đồng ý đặt cọc lại để xác nhận khung giờ mới.
            </span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={confirmSchedule}
          disabled={!newTime || (!isFreeReschedule && !acceptedDepositPolicy)}
          className="mt-4 w-full rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isFreeReschedule ? "Xác nhận đổi lịch (miễn phí)" : `Đổi lịch & đặt cọc lại ${formatMoney(depositAmount)}`}
        </button>
        {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
      </div>
    </main>
  );
}
