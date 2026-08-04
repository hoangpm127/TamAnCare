"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { CalendarClock, QrCode, Receipt, Star } from "lucide-react";
import { bookingDisplayStatusLabel } from "@/lib/labels";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";
import { useCustomerProfile } from "@/lib/customer-profile-store";

const UPCOMING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED", "READY", "AWAITING_BALANCE"];
const HISTORY_STATUSES = ["COMPLETED", "CANCELLED"];

const STATUS_BADGE_STYLE: Record<string, string> = {
  CONFIRMED: "bg-[#f8ebe5] text-[#c64b32]",
  PENDING: "bg-[#fff7df] text-[#76551d]",
  CHECKED_IN: "bg-[#eef4ff] text-[#2452b8]",
  IN_SERVICE: "bg-[#eef4ff] text-[#2452b8]",
  COMPLETED: "bg-[#fff4e6] text-[#a85f29]",
  CANCELLED: "bg-[#f3efec] text-[#826f66]",
};

type OrderView = {
  id: string;
  bookingCode: string;
  serviceName: string;
  therapistName: string;
  startTime: Date;
  status: string;
  totalAmount: number;
  depositAmount?: number;
  paidAmount: number;
  paymentStatus: string;
  kind?: "BOOKING" | "BUSINESS";
  location?: string;
};

export function OrdersClient() {
  const params = useSearchParams();
  const router = useRouter();
  const customerProfile = useCustomerProfile();
  const [serverOrders, setServerOrders] = useState<OrderView[]>([]);
  const [customerAuthenticated, setCustomerAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState("");
  const tab = params.get("tab") === "history" ? "history" : "upcoming";

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ limit: "100" });
    async function load() {
      try {
        query.set("audience", "customer");
        const bookingResponse = await fetch(`/api/bookings?${query}`, { cache: "no-store" });
        const data = await bookingResponse.json();
        if (!bookingResponse.ok) throw new Error(data.error ?? "Không thể tải lịch đã đặt.");
        const bookingOrders = (data.bookings ?? []).filter((item: { timeIso?: string }) => item.timeIso).map((item: { id: string; referenceCode: string; serviceLabel: string; therapistName: string; timeIso: string; status: string; totalAmount: number; depositAmount: number; paidAmount: number; paymentStatus: string }) => ({
          id: item.id,
          bookingCode: item.referenceCode,
          serviceName: item.serviceLabel,
          therapistName: item.therapistName,
          startTime: new Date(item.timeIso),
          status: item.status,
          totalAmount: item.totalAmount,
          depositAmount: item.depositAmount,
          paidAmount: item.paidAmount,
          paymentStatus: item.paymentStatus,
          kind: "BOOKING" as const,
        }));
        const businessResponse = await fetch("/api/business-events?audience=customer", { cache: "no-store" });
        const businessData = await businessResponse.json();
        if (!businessResponse.ok) throw new Error(businessData.error ?? "Không thể tải lịch Tâm An Business.");
        const businessOrders = (businessData.events ?? []).map((item: { eventCode: string; companyName: string; serviceLabel?: string; leadTherapist?: string; startsAt: string; status: string; totalAmount: number; depositAmount: number; paidAmount: number; paymentStatus: string; location: string }) => ({
          id: `business-${item.eventCode}`,
          bookingCode: item.eventCode,
          serviceName: `Tâm An Business · ${item.companyName}`,
          therapistName: item.leadTherapist ?? "Đang phân công KTV trưởng",
          startTime: new Date(item.startsAt),
          status: item.status,
          totalAmount: item.totalAmount,
          depositAmount: item.depositAmount,
          paidAmount: item.paidAmount,
          paymentStatus: item.paymentStatus,
          kind: "BUSINESS" as const,
          location: item.location,
        }));
        if (active) {
          setServerOrders([...bookingOrders, ...businessOrders]);
          setCustomerAuthenticated(Boolean(data.authenticated));
          setLoadError("");
        }
      } catch (reason) {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Không thể đồng bộ đơn của bạn.");
      }
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const upcoming = serverOrders.filter((item) => UPCOMING_STATUSES.includes(item.status)).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const history = serverOrders.filter((item) => HISTORY_STATUSES.includes(item.status)).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  const totalSpendCompleted = history
    .filter((booking) => booking.status === "COMPLETED")
    .reduce((sum, booking) => sum + booking.totalAmount, 0);

  const list = tab === "upcoming" ? upcoming : history;

  function setTab(next: "upcoming" | "history") {
    router.push(`/don-cua-toi?tab=${next}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#281b18] sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Đơn của tôi</h1>
      <p className="mt-1 text-sm text-[#68574f]">Lịch hẹn và hoá đơn gần đây của {customerProfile.fullName || "bạn"}.</p>

      <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-full border border-[#e7d6ca] bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold transition",
            tab === "upcoming" ? "bg-[#c64b32] text-white" : "text-[#51423b]"
          )}
        >
          <CalendarClock size={16} /> Lịch đã đặt
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold transition",
            tab === "history" ? "bg-[#c64b32] text-white" : "text-[#51423b]"
          )}
        >
          <Receipt size={16} /> Lịch sử & hoá đơn
        </button>
      </div>

      {tab === "history" ? (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#231514] p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-white/70">Tổng chi tiêu đã hoàn thành</p>
            <p className="mt-1 text-xl font-semibold">{formatMoney(totalSpendCompleted)}</p>
          </div>
          <p className="text-sm text-white/80">{history.filter((b) => b.status === "COMPLETED").length} buổi</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e7d6ca] bg-white p-8 text-center">
            <p className="text-sm text-[#68574f]">
              {loadError
                ? "Chưa thể đồng bộ đơn. Vui lòng kiểm tra kết nối và thử lại."
                : tab === "upcoming" ? "Bạn chưa có lịch hẹn sắp tới." : "Chưa có lịch sử booking nào."}
            </p>
            <Link href="/booking" className="mt-4 inline-flex rounded-full bg-[#c64b32] px-5 py-2.5 text-sm font-semibold text-white">
              Đặt lịch ngay
            </Link>
            {!customerAuthenticated ? (
              <Link href="/tai-khoan" className="ml-2 mt-4 inline-flex rounded-full border border-[#c64b32] px-5 py-2.5 text-sm font-semibold text-[#c64b32]">
                Đăng nhập để khôi phục lịch
              </Link>
            ) : null}
          </div>
        ) : (
          list.map((booking) => {
            const isReserved = ["CONFIRMED", "DEPOSIT_CONFIRMED", "READY"].includes(booking.status) && ["DEPOSITED", "PAID"].includes(booking.paymentStatus);
            const displayStartTime = booking.startTime;
            const isBusiness = booking.kind === "BUSINESS";
            const businessLabel: Record<string, string> = { AWAITING_DEPOSIT: "Chờ đối soát cọc", DEPOSIT_CONFIRMED: "Đã cọc · đang điều phối", READY: "Sẵn sàng", IN_SERVICE: "Đang phục vụ", AWAITING_BALANCE: "Chờ thanh toán", COMPLETED: "Đã hoàn tất dịch vụ & thanh toán", CANCELLED: "Đã hủy" };
            return (
              <div key={booking.id} className="rounded-xl border border-[#e7d6ca] bg-white p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{booking.serviceName}</p>
                    <p className="mt-1 text-xs text-[#68574f]">
                      {format(displayStartTime, "HH:mm dd/MM")} · {booking.therapistName}
                    </p>
                    {isBusiness && booking.location ? <p className="mt-1 line-clamp-1 text-[11px] text-[#826f66]">{booking.location}</p> : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isReserved ? "bg-[#f8ebe5] text-[#c64b32]" : STATUS_BADGE_STYLE[booking.status]
                    )}
                  >
                    {isBusiness ? businessLabel[booking.status] ?? booking.status : booking.status === "PENDING" && booking.paymentStatus === "UNPAID"
                      ? "Chờ đối soát cọc"
                      : booking.status === "PENDING" && booking.paymentStatus === "DEPOSITED"
                        ? "Đã cọc · TÂM AN CENTER đang xếp lịch"
                        : bookingDisplayStatusLabel(booking.status, booking.paidAmount)}
                  </span>
                </div>
                {isReserved ? (
                  <p className="mt-1.5 text-[11px] text-[#826f66]">
                    Đã cọc {formatMoney(booking.paidAmount)} · Còn lại {formatMoney(booking.totalAmount - booking.paidAmount)} thanh toán sau dịch vụ
                  </p>
                ) : null}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#eee0d6] pt-2.5">
                  <span className="text-[11px] text-[#826f66]">
                    {displayBookingCode(booking.bookingCode)} · <span className="text-sm font-semibold text-[#281b18]">{formatMoney(booking.totalAmount)}</span>
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isBusiness ? <Link href={`/doanh-nghiep/${booking.bookingCode}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#c64b32]"><Receipt size={12} /> Xem hồ sơ & Bill</Link> : booking.status === "COMPLETED" ? (
                      <Link href={`/review/${booking.bookingCode}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#c64b32]">
                        <Star size={12} /> Đánh giá
                      </Link>
                    ) : null}
                    {!isBusiness && booking.status === "CONFIRMED" && ["DEPOSITED", "PAID"].includes(booking.paymentStatus) ? (
                      <Link href={`/check-in?bookingCode=${encodeURIComponent(booking.bookingCode)}`} className="inline-flex items-center gap-1 rounded-full bg-[#76551d] px-3 py-1.5 text-xs font-semibold text-white">
                        <QrCode size={13} /> Mở Camera quét QR
                      </Link>
                    ) : null}
                    {!isBusiness && booking.status === "PENDING" && ["DEPOSITED", "PAID"].includes(booking.paymentStatus) ? (
                      <span className="text-[10px] font-medium text-[#826f66]">QR mở ngay khi TÂM AN CENTER xếp xong KTV & giường</span>
                    ) : null}
                    {!isBusiness && (booking.status === "CHECKED_IN" || booking.status === "IN_SERVICE") ? (
                      <Link href={`/thanh-toan/${booking.bookingCode}`} className="rounded-full bg-[#c64b32] px-3 py-1.5 text-xs font-semibold text-white">
                        Thanh toán Bill
                      </Link>
                    ) : null}
                    {!isBusiness && ["PENDING", "CONFIRMED"].includes(booking.status) ? (
                      <Link href={`/don-cua-toi/doi-lich/${booking.bookingCode}`} className="text-xs font-semibold text-[#c64b32]">
                        Đổi lịch?
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
