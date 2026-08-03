"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ReceiptText, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { BankAppLauncher } from "@/components/bank-app-launcher";
import { displayBookingCode, formatMoney } from "@/lib/utils";

type BookingView = {
  referenceCode: string;
  serviceLabel: string;
  branchLabel: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  usedPackage?: boolean;
  packageName?: string | null;
  checkoutPayment?: { status: string } | null;
};

export function CheckoutPaymentFlow({ bookingCode }: { bookingCode: string }) {
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openedBank, setOpenedBank] = useState("");

  const loadBooking = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/booking-groups/${encodeURIComponent(bookingCode)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể tải Bill.");
      setBooking(data.booking as BookingView);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải Bill.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingCode]);

  useEffect(() => {
    queueMicrotask(() => void loadBooking());
    const timer = window.setInterval(() => void loadBooking(true), 3_000);
    return () => window.clearInterval(timer);
  }, [loadBooking]);

  if (loading) return <main className="flex min-h-[65vh] items-center justify-center bg-[#fffaf6] text-sm text-[#665b55]"><Loader2 className="mr-2 animate-spin text-[#9f1d20]" size={18} /> Đang tải Bill cần thanh toán...</main>;
  if (!booking) return <main className="mx-auto max-w-md px-4 py-10 text-center"><section className="rounded-2xl border border-[#eadbd1] bg-white p-6"><ReceiptText className="mx-auto text-[#9f1d20]" /><h1 className="mt-3 text-lg font-semibold">Chưa thể mở thanh toán</h1><p className="mt-2 text-sm leading-6 text-[#665b55]">{error || "Không tìm thấy Bill."}</p><Link href="/don-cua-toi" className="mt-4 inline-flex rounded-full bg-[#9f1d20] px-5 py-2.5 text-sm font-semibold text-white">Về đơn của tôi</Link></section></main>;

  const paid = booking.paymentStatus === "PAID" || booking.checkoutPayment?.status === "CONFIRMED" || booking.dueAmount === 0;
  if (paid) return <main className="mx-auto max-w-md px-4 py-8 text-center"><section className="overflow-hidden rounded-2xl border border-[#eadbd1] bg-white shadow-lg"><div className="bg-gradient-to-br from-[#7a2318] to-[#231514] p-6 text-white"><CheckCircle2 className="mx-auto text-[#f5d982]" size={36} /><h1 className="mt-3 text-xl font-semibold">Đã thanh toán</h1><p className="mt-1 text-xs text-white/70">{displayBookingCode(booking.referenceCode)}</p></div><div className="p-5"><p className="text-sm leading-6 text-[#665b55]">Quầy đã xác nhận nhận đủ phần còn lại của Bill. Doanh thu cơ sở và phí nền tảng đã được hạch toán tách biệt.</p><p className="mt-3 rounded-xl bg-[#fff7ec] p-3 text-xs leading-5 text-[#805914]">Tip hoàn toàn tùy tâm và được trao trực tiếp cho KTV, không nằm trong Bill này.</p><Link href="/don-cua-toi" className="mt-4 inline-flex rounded-full bg-[#9f1d20] px-5 py-2.5 text-sm font-semibold text-white">Theo dõi trạng thái dịch vụ</Link></div></section></main>;

  return (
    <main className="mx-auto max-w-2xl bg-[#fffaf6] px-4 py-6 text-[#191414]">
      <section className="overflow-hidden rounded-2xl border border-[#eadbd1] bg-white shadow-lg">
        <div className="bg-gradient-to-br from-[#7a2318] to-[#231514] p-5 text-white"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f5d982]"><ShieldCheck size={13} /> Thanh toán tại quầy</p><h1 className="mt-1.5 text-xl font-semibold">{booking.serviceLabel}</h1><p className="mt-1 text-xs text-white/70">{booking.branchLabel} · {displayBookingCode(booking.referenceCode)}</p></div>
        <div className="grid grid-cols-3 divide-x divide-[#eadbd1] border-b border-dashed border-[#eadbd1] px-2 py-4 text-center"><span className="px-1 text-[10px] text-[#8a7a72]">Tổng Bill<strong className="mt-1 block text-sm text-[#191414]">{formatMoney(booking.totalAmount)}</strong></span><span className="px-1 text-[10px] text-[#8a7a72]">Đã đặt cọc<strong className="mt-1 block text-sm text-[#16784a]">{formatMoney(booking.paidAmount)}</strong></span><span className="px-1 text-[10px] text-[#8a7a72]">Còn lại<strong className="mt-1 block text-sm text-[#9f1d20]">{formatMoney(booking.dueAmount)}</strong></span></div>
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-[#e8d39e] bg-[#fffaf0] p-3.5"><p className="flex items-center gap-1.5 text-sm font-semibold text-[#805914]"><Sparkles size={15} /> Tip KTV hoàn toàn tùy tâm</p><p className="mt-1 text-[11px] leading-5 text-[#665b55]">Nếu hài lòng, bạn có thể trao Tip trực tiếp cho KTV. Tip không cộng vào Bill và không chuyển chung với khoản thanh toán cho cơ sở.</p></div>
          <div className="rounded-2xl bg-[#f7f3ef] p-4 text-center"><p className="text-sm font-semibold">Thanh toán trực tiếp tại quầy</p><p className="mt-1 text-[11px] leading-5 text-[#665b55]">Mở ngân hàng bạn đang dùng, sau đó thực hiện giao dịch theo hướng dẫn trực tiếp của Lễ tân hoặc Quản lý cơ sở.</p><div className="mt-3"><BankAppLauncher onOpened={setOpenedBank} /></div>{openedBank ? <p className="mt-3 rounded-xl bg-[#eef8f2] px-3 py-2 text-[10px] leading-4 text-[#3e6652]">Đã mở {openedBank}. Sau khi thanh toán, vui lòng báo quầy bấm “Đã thanh toán”; màn hình này sẽ tự cập nhật.</p> : null}</div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d5eadc] bg-[#f3fbf6] p-3"><span className="text-[10px] leading-4 text-[#567063]">Đang chờ quầy xác nhận đã nhận đủ Bill.</span><button type="button" disabled={refreshing} onClick={() => { setRefreshing(true); void loadBooking(true); }} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-[#16784a]"><RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Cập nhật</button></div>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
