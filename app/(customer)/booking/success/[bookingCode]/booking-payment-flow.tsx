"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Receipt,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import {
  confirmBookingPaymentDraft,
  markBookingPaymentPending,
  readBookingPaymentDraft,
  saveBookingPaymentDraft,
  type BookingPaymentDraft,
} from "@/lib/booking-payment-store";
import { usePublicCatalog } from "@/lib/catalog-store";
import { displayBookingCode, formatMoney } from "@/lib/utils";
import { refreshWalletLedger } from "@/lib/wallet-ledger";

type PaymentStage = "loading" | "awaiting" | "preparing" | "banking" | "reconciling" | "confirmed" | "missing";

type ServerBooking = {
  status: string;
  paymentStatus: string;
  serviceLabel: string;
  therapistName: string;
  timeIso: string;
  durationMin: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositAmount: number;
  dueAmount: number;
  voucherCode?: string | null;
  usedPackage?: boolean;
  customerPackageId?: string | null;
  packageName?: string | null;
  holdExpiresAt?: string | null;
  items?: { name: string; qty: number; amount: number; subtotalAmount?: number }[];
  depositPayment?: {
    status: string;
    paymentCode?: string | null;
  } | null;
};

function aggregateItems(items: NonNullable<ServerBooking["items"]>) {
  const grouped = new Map<string, { name: string; qty: number; amount: number }>();
  items.forEach((item) => {
    const current = grouped.get(item.name);
    if (current) {
      current.qty += item.qty;
      current.amount += item.subtotalAmount ?? item.amount;
      return;
    }
    grouped.set(item.name, { name: item.name, qty: item.qty, amount: item.subtotalAmount ?? item.amount });
  });
  return [...grouped.values()];
}

export function BookingPaymentFlow({ referenceCode }: { referenceCode: string }) {
  const catalog = usePublicCatalog();
  const branches = catalog?.branches ?? [];
  const [draft, setDraft] = useState<BookingPaymentDraft | null>(null);
  const [stage, setStage] = useState<PaymentStage>("loading");
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [serverPaymentStatus, setServerPaymentStatus] = useState<string | null>(null);
  const [paymentCode, setPaymentCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const syncServerBooking = useCallback((booking: ServerBooking, savedDraft?: BookingPaymentDraft) => {
    setServerStatus(booking.status);
    setServerPaymentStatus(booking.paymentStatus);
    setPaymentCode(booking.depositPayment?.paymentCode ?? null);
    if (booking.status === "CANCELLED") {
      setStage("missing");
      return;
    }
    const paymentConfirmed = booking.depositPayment?.status === "CONFIRMED"
      || ["DEPOSITED", "PAID"].includes(booking.paymentStatus);
    setDraft((current) => {
      const target = savedDraft ?? current;
      if (!target) return target;
      const synchronized: BookingPaymentDraft = {
        ...target,
        summary: {
          ...target.summary,
          serviceLabel: booking.serviceLabel ?? target.summary.serviceLabel,
          therapistLabel: booking.therapistName ?? target.summary.therapistLabel,
          timeIso: booking.timeIso ?? target.summary.timeIso,
          durationMin: booking.durationMin ?? target.summary.durationMin,
          subtotal: booking.subtotalAmount,
          total: booking.totalAmount,
          depositAmount: booking.depositAmount,
          dueAmount: paymentConfirmed
            ? booking.dueAmount
            : Math.max(0, booking.totalAmount - booking.depositAmount),
          discount: booking.discountAmount || undefined,
          voucherCode: booking.voucherCode ?? undefined,
          count: booking.items?.length ?? target.summary.count,
          items: booking.items ? aggregateItems(booking.items) : target.summary.items,
          packageName: booking.packageName ?? undefined,
          customerPackageId: booking.customerPackageId ?? undefined,
        },
      };
      if (paymentConfirmed && synchronized.status !== "CONFIRMED") return confirmBookingPaymentDraft(synchronized);
      saveBookingPaymentDraft(synchronized);
      return synchronized;
    });
    if (paymentConfirmed) {
      setStage("confirmed");
      void refreshWalletLedger();
      return;
    }
    if (savedDraft) setStage(savedDraft.status === "PENDING_RECONCILIATION" ? "reconciling" : "banking");
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const saved = readBookingPaymentDraft(referenceCode);
      if (!active) return;
      setDraft(saved);
      if (!saved) {
        setStage("missing");
        return;
      }
      const response = await fetch(`/api/booking-groups/${encodeURIComponent(referenceCode)}`, { cache: "no-store" });
      if (!active) return;
      if (!response.ok) {
        setStage("awaiting");
        return;
      }
      const data = await response.json();
      syncServerBooking(data.booking as ServerBooking, saved);
    }
    void load();
    return () => {
      active = false;
    };
  }, [referenceCode, syncServerBooking]);

  useEffect(() => {
    if (!["banking", "reconciling", "confirmed"].includes(stage)) return;
    let active = true;
    async function refreshStatus() {
      const response = await fetch(`/api/booking-groups/${encodeURIComponent(referenceCode)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (active) syncServerBooking(data.booking as ServerBooking);
    }
    void refreshStatus();
    const timer = window.setInterval(refreshStatus, stage === "reconciling" ? 1000 : 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [referenceCode, stage, syncServerBooking]);

  async function createReservation() {
    if (!draft?.summary.policyAcceptedAt) {
      throw new Error("Yêu cầu cũ chưa có xác nhận chính sách. Vui lòng quay lại màn hình đặt lịch để xác nhận trước khi giữ chỗ.");
    }
    if (!draft) throw new Error("Không tìm thấy yêu cầu đặt lịch.");
    setError("");
    const response = await fetch("/api/booking-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceCode: draft.referenceCode,
        branchId: draft.summary.branchId,
        customerName: draft.requestPayloads[0]?.customerName ?? draft.summary.nickName ?? "Khách Tâm An",
        customerPhone: draft.requestPayloads[0]?.customerPhone ?? "",
        // summary.voucherCode is presentation text and may contain the stacked
        // label "WELCOME150+AFF50". The API expects the primary voucher only;
        // AFF50 is derived again from the account-bound referral on the server.
        voucherCode: draft.requestPayloads[0]?.voucherCode
          ?? draft.summary.voucherCode?.split("+")[0],
        campaignCode: draft.requestPayloads[0]?.campaignCode,
        relationship: draft.summary.relationship,
        careNote: draft.summary.careNote,
        source: draft.requestPayloads[0]?.source,
        acceptTerms: true,
        acceptPrivacy: true,
        acceptBookingPolicy: true,
        units: draft.requestPayloads.map((payload) => ({
          bookingCode: payload.bookingCode,
          serviceId: payload.serviceId,
          startTime: payload.startTime,
          therapistId: payload.therapistId,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          note: payload.note,
          source: payload.source,
        })),
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể giữ khung giờ đặt lịch.");
    syncServerBooking(data.booking as ServerBooking);

    return data.booking as ServerBooking;
  }

  async function beginTransfer() {
    setStage("preparing");
    try {
      await createReservation();
      setStage("banking");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể giữ khung giờ. Vui lòng thử lại.");
      setStage("awaiting");
    }
  }

  async function checkPaymentNow() {
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/booking-groups/${encodeURIComponent(referenceCode)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      syncServerBooking(data.booking as ServerBooking);
    } finally {
      setCheckingStatus(false);
    }
  }

  async function confirmDeposit() {
    if (!draft) return;
    setError("");
    const pending = markBookingPaymentPending(draft);
    setDraft(pending);
    setStage("reconciling");
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/booking-groups/${encodeURIComponent(referenceCode)}/simulate-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.booking) syncServerBooking(data.booking as ServerBooking);
      } else if (response.status !== 404) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Ngân hàng chưa xác nhận giao dịch. Hệ thống sẽ tiếp tục kiểm tra tự động.");
      }
    } catch {
      // Không chặn khách ở màn hình thanh toán; polling sẽ tiếp tục đối soát.
    } finally {
      setCheckingStatus(false);
    }
  }

  if (stage === "loading") {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#fdf8f3] p-6 text-[#68574f]">
        <Loader2 className="mr-2 animate-spin" size={18} /> Đang tải yêu cầu đặt cọc...
      </main>
    );
  }

  if (!draft || stage === "missing") {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#fdf8f3] px-4 py-8 text-[#281b18]">
        <section className="w-full max-w-md rounded-2xl border border-[#e7d6ca] bg-white p-6 text-center shadow-sm">
          <Clock3 className="mx-auto text-[#c64b32]" size={30} />
          <h1 className="mt-3 text-lg font-semibold">Yêu cầu giữ chỗ không còn hiệu lực</h1>
          <p className="mt-1 text-sm leading-6 text-[#68574f]">Hãy chọn lại dịch vụ và khung giờ để tạo yêu cầu đặt cọc mới.</p>
          <Link href="/booking" className="mt-4 inline-flex rounded-full bg-[#c64b32] px-5 py-2.5 text-sm font-semibold text-white">
            Chọn lại lịch
          </Link>
        </section>
      </main>
    );
  }

  const summary = draft.summary;
  const appointmentTime = new Date(summary.timeIso);
  const branchInfo = branches.find((item) => item.id === summary.branchId) ?? branches[0] ?? {
    id: summary.branchId,
    label: "Cơ sở đang cập nhật",
    address: "Vui lòng mở mục Liên hệ để kiểm tra địa chỉ.",
  };
  const adminConfirmed = serverStatus === "CONFIRMED";

  if (stage === "confirmed") {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#fdf8f3] px-4 py-8 text-[#281b18]">
        <section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-lg">
          <div className="bg-gradient-to-br from-[#8c332a] to-[#231514] px-5 py-5 text-center text-white">
            <CheckCircle2 className="mx-auto text-[#c59a3d]" size={32} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f4c2b6]">{adminConfirmed ? "Đã xác nhận · Sẵn sàng đón khách" : summary.packageName ? "Đã giữ lượt gói · TÂM AN CENTER đang xếp lịch" : "Đã nhận cọc · TÂM AN CENTER đang xếp lịch"}</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">{adminConfirmed ? "Chúc mừng! Lịch đã được sắp xếp" : summary.serviceLabel}</h1>
            {adminConfirmed ? <p className="mt-1 text-xs text-white/75">{summary.serviceLabel} · {summary.therapistLabel}</p> : null}
          </div>

          <div className="space-y-2 px-5 py-4 text-sm text-[#51423b]">
            <p className="flex items-center gap-2">
              <CalendarClock size={15} className="shrink-0 text-[#c64b32]" />
              {format(appointmentTime, "HH:mm")} · {format(appointmentTime, "dd/MM/yyyy")} · {summary.durationMin} phút
            </p>
            <p className="flex items-center gap-2">
              <UserRound size={15} className="shrink-0 text-[#c64b32]" />
              {summary.therapistLabel}{summary.nickName ? ` · Khách ${summary.nickName}` : ""}
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-[#c64b32]" /> {branchInfo.label} · {branchInfo.address}
            </p>
          </div>

          <div className="relative border-t border-dashed border-[#e7d6ca] px-5 py-5 text-center">
            <span className="absolute left-0 top-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fdf8f3]" />
            <span className="absolute right-0 top-0 h-6 w-6 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fdf8f3]" />
            <p className="font-mono text-base font-bold tracking-wide">{displayBookingCode(draft.referenceCode)}</p>
            <p className="mt-0.5 text-xs text-[#826f66]">Mã bill đã đặt chỗ · {branchInfo.label}</p>
            {adminConfirmed ? (
              <Link href="/don-cua-toi?tab=upcoming" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#c64b32] px-4 py-2.5 text-xs font-semibold text-white">
                <CalendarClock size={14} /> Xem lịch đã đặt
              </Link>
            ) : (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#eee0d6] px-4 py-2.5 text-xs font-semibold text-[#826f66]">
                <Clock3 size={14} /> TÂM AN CENTER đang xếp KTV và giường/ghế
              </span>
            )}
            {adminConfirmed ? <p className="mx-auto mt-2 max-w-xs text-[10px] leading-4 text-[#826f66]">Khi đến, bạn chỉ cần đọc họ tên và số điện thoại. Lễ tân sẽ làm thủ tục check-in, lên giường, check-out và xác nhận thanh toán.</p> : null}
          </div>

          <div className="border-t border-dashed border-[#e7d6ca] px-5 py-4">
            <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c64b32]">
              <Receipt size={13} /> Bill đã đặt chỗ
            </p>
            <div className="space-y-1.5 text-sm">
              {summary.items.map((item) => (
                <div key={item.name} className="flex items-start justify-between gap-3 text-[#68574f]">
                  <span>{item.name}{item.qty > 1 ? ` x${item.qty}` : ""}</span>
                  <span className="shrink-0 font-semibold text-[#281b18]">{formatMoney(item.amount)}</span>
                </div>
              ))}
              {summary.packageName ? (
                <div className="flex items-center justify-between font-medium text-[#a85f29]">
                  <span>Đã dùng {summary.packageName}</span>
                  <span>-{formatMoney(summary.discount ?? summary.subtotal)}</span>
                </div>
              ) : summary.discount ? (
                <div className="flex items-center justify-between font-medium text-[#a85f29]">
                  <span>Giảm {summary.voucherCode ? `(${summary.voucherCode})` : ""}</span>
                  <span>-{formatMoney(summary.discount)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-3 space-y-2 border-t border-dashed border-[#e7d6ca] pt-3 text-sm">
              <div className="flex items-center justify-between font-semibold">
                <span>Tổng dịch vụ</span><span>{formatMoney(summary.total)}</span>
              </div>
              {summary.packageName ? (
                <div className="flex items-center justify-between rounded-xl bg-[#fbf2e7] px-3 py-2.5 text-[#ad432f]">
                  <span>Thanh toán thêm</span><span className="font-bold">0đ</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[#a85f29]">
                    <span>Đã đặt cọc</span><span className="font-semibold">-{formatMoney(summary.depositAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#f8ebe5] px-3 py-2.5 text-[#c64b32]">
                    <span>Còn lại tại cơ sở · đã trừ ưu đãi</span><span className="font-bold">{formatMoney(summary.dueAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 border-t border-dashed border-[#e7d6ca] p-4">
            <Link href="/don-cua-toi?tab=upcoming" className="flex-1 rounded-full bg-[#c64b32] px-4 py-2.5 text-center text-sm font-semibold text-white">Lịch đã đặt</Link>
            <Link href="/vi" className="flex-1 rounded-full border border-[#c64b32] px-4 py-2.5 text-center text-sm font-semibold text-[#c64b32]">Xem Thu - Chi</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl bg-[#fdf8f3] px-4 py-6 text-[#281b18] sm:px-6">
      <section className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-lg">
        <div className="bg-gradient-to-br from-[#8c332a] to-[#231514] px-5 py-5 text-white">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4c2b6]">
            <ShieldCheck size={14} /> Bước cuối để giữ chỗ
          </p>
          <h1 className="mt-1.5 text-xl font-semibold">{summary.packageName ? "Dùng lượt gói để xác nhận lịch" : "Chuyển cọc để xác nhận lịch"}</h1>
          <p className="mt-1 text-xs leading-5 text-white/75">{summary.packageName ? `Hệ thống sẽ giữ lượt từ ${summary.packageName}; chưa phát sinh khoản thanh toán mới.` : "Khung giờ được tạm giữ trong lúc ngân hàng tự động đối soát khoản cọc."}</p>
        </div>

        <div className="border-b border-dashed border-[#e7d6ca] px-4 py-3 text-sm text-[#51423b]">
          <div className="flex items-center justify-between gap-2"><p className="font-semibold text-[#281b18]">Dịch vụ đã chọn</p><span className="rounded-full bg-[#f8ebe5] px-2 py-1 text-[9px] font-semibold text-[#c64b32]">{summary.count} khách</span></div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {summary.items.map((item) => <div key={item.name} className="flex items-center justify-between gap-2 rounded-lg bg-[#fdf8f3] px-2.5 py-2"><span className="min-w-0 truncate text-[11px] font-medium"><strong className="mr-1 text-[#c64b32]">{item.qty}×</strong>{item.name}</span><span className="shrink-0 text-[10px] font-semibold">{formatMoney(item.amount)}</span></div>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#68574f]">
          <p className="flex items-center gap-2"><CalendarClock size={15} className="text-[#c64b32]" /> {format(appointmentTime, "HH:mm dd/MM/yyyy")} · {summary.durationMin} phút</p>
          <p className="flex items-center gap-2"><MapPin size={15} className="text-[#c64b32]" /> {branchInfo.label}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#e7d6ca] border-b border-dashed border-[#e7d6ca] px-3 py-4 text-center">
          <div className="px-2"><p className="text-[10px] uppercase text-[#826f66]">Tổng dịch vụ</p><p className="mt-1 text-sm font-semibold">{formatMoney(summary.total)}</p></div>
          <div className="px-2"><p className="text-[10px] uppercase text-[#826f66]">{summary.packageName ? "Lượt gói" : "Cọc ngay"}</p><p className="mt-1 text-sm font-bold text-[#c64b32]">{summary.packageName ? summary.count : formatMoney(summary.depositAmount)}</p></div>
          <div className="px-2"><p className="text-[10px] uppercase text-[#826f66]">Thanh toán thêm</p><p className="mt-1 text-sm font-semibold">{formatMoney(summary.dueAmount)}</p></div>
        </div>

        <div className="p-5">
          {stage === "awaiting" ? (
            <div className="rounded-2xl border border-[#d2ad5d]/60 bg-gradient-to-br from-[#2a1916] via-[#4b2619] to-[#7d211f] p-4 text-white shadow-lg">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#e7c878]"><Wallet size={16} /> {summary.packageName ? `Sẵn sàng dùng ${summary.packageName}` : "Sẵn sàng giữ lịch bằng khoản cọc"}</p>
              <p className="mt-1.5 text-xs leading-5 text-white/70">{summary.packageName ? "Xác nhận để hệ thống giữ lượt gói và gửi lịch cho cơ sở duyệt." : "Khoản cọc bằng 10% giá trị cuối cùng sau ưu đãi và được chuyển vào tài khoản nền tảng."}</p>
              <button type="button" onClick={beginTransfer} className="mt-3 w-full rounded-full bg-[#e7c878] px-4 py-3 text-sm font-semibold text-[#3d1f12]">{summary.packageName ? "Dùng lượt gói để giữ lịch" : "Chuyển khoản đặt cọc dịch vụ"}</button>
            </div>
          ) : stage === "preparing" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#f8ebe5] p-5 text-sm font-semibold text-[#c64b32]">
              <Loader2 className="animate-spin" size={18} /> Đang giữ khung giờ và tạo mã chuyển khoản...
            </div>
          ) : stage === "reconciling" ? (
            <div className="rounded-2xl border border-[#e8d39e] bg-gradient-to-br from-[#fffaf0] to-white p-4 text-center shadow-sm">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1c7] text-[#c64b32]"><Clock3 size={23} /></span>
              <h2 className="mt-2.5 text-base font-semibold">Ngân hàng đang xác nhận giao dịch</h2>
              <p className="mt-1 text-xs leading-5 text-[#68574f]">Bạn không cần chờ tại màn hình này. Hệ thống tiếp tục đối soát tự động và gửi thông báo ngay khi nhận đúng khoản cọc.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-xs">
                <span className="text-[#826f66]">Số tiền<strong className="mt-1 block text-sm text-[#c64b32]">{formatMoney(summary.depositAmount)}</strong></span>
                <span className="text-[#826f66]">Nội dung CK<strong className="mt-1 block break-all font-mono text-[11px] text-[#281b18]">{paymentCode ?? draft.referenceCode}</strong></span>
              </div>
              <p className="mt-3 text-[11px] text-[#826f66]">Trạng thái máy chủ: {serverPaymentStatus === "UNPAID" ? "Chưa đối soát" : serverPaymentStatus ?? "Đang cập nhật"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void checkPaymentNow()} disabled={checkingStatus} className="flex items-center justify-center gap-1.5 rounded-full border border-[#c64b32] px-3 py-2.5 text-xs font-semibold text-[#c64b32] disabled:opacity-55">{checkingStatus ? <Loader2 className="animate-spin" size={13} /> : null} Kiểm tra ngay</button><Link href="/don-cua-toi?tab=upcoming" className="rounded-full bg-[#c64b32] px-3 py-2.5 text-xs font-semibold text-white">Về lịch của tôi</Link></div>
              <button type="button" onClick={() => setStage("banking")} className="mt-3 text-xs font-semibold text-[#c64b32] underline underline-offset-4">Xem lại thông tin chuyển khoản</button>
            </div>
          ) : (
            <>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><Wallet size={16} className="text-[#c64b32]" /> Quét VietQR hoặc mở ứng dụng ngân hàng</p>
              <BankTransferDetails amount={summary.depositAmount} transferContent={paymentCode ?? draft.referenceCode} onConfirm={confirmDeposit} helperText="Đây là tài khoản nhận cọc của nền tảng. Bill chỉ ghi nhận đã cọc sau khi SePay đối soát đúng 10% giá sau ưu đãi." />
            </>
          )}
          {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
