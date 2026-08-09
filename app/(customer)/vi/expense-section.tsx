"use client";

import Link from "next/link";
import { Briefcase, ChevronDown, Hourglass, Receipt, RotateCcw, Users } from "lucide-react";
import { useWalletLedger, type LedgerEntry } from "@/lib/wallet-ledger";
import { computeActualServiceMinutes } from "@/lib/time-delay";
import { billStatusLabel } from "@/lib/labels";
import { useExpandToggle } from "@/lib/use-expand-toggle";
import { cn, displayBookingCode, formatMoney } from "@/lib/utils";

type BillStatus = "UNUSED" | "IN_SERVICE" | "COMPLETED" | "ATTENTION";

export type BillCardData = {
  key: string;
  status: BillStatus;
  label: string;
  bookingCode: string;
  branchLabel?: string;
  therapistName?: string;
  scheduledTime?: string;
  actualCheckinTime?: string;
  checkoutRequestedAt?: string;
  checkoutDate?: string;
  checkoutTime?: string;
  serviceDurationMin?: number;
  totalAmount?: number;
  depositAmount?: number;
  tipAmount?: number;
  refundAmount?: number;
  amount: number;
  note?: string;
  paymentStatus?: LedgerEntry["paymentStatus"];
  serviceStatus?: LedgerEntry["serviceStatus"];
  isBusiness?: boolean;
  isGroup?: boolean;
  packageName?: string;
  items?: { name: string; qty: number; amount: number }[];
};

function isMultiPerson(items: { name: string; qty: number }[]) {
  return items.length > 1 || items.some((line) => line.qty > 1);
}

function isDepositOnly(entry: LedgerEntry) {
  return entry.paymentStatus === "DEPOSIT_ONLY" || (!entry.paymentStatus && entry.label.toLocaleLowerCase("vi").startsWith("đặt cọc"));
}

function isCompletedLedgerEntry(entry: LedgerEntry) {
  return entry.serviceStatus === "COMPLETED" || entry.paymentStatus === "PAID_IN_FULL" || entry.paymentStatus === "PACKAGE_PURCHASE";
}

export function useUnusedBills(): BillCardData[] {
  const ledgerEntries = useWalletLedger();
  const completedBookingCodes = new Set(ledgerEntries.filter(isCompletedLedgerEntry).map((entry) => entry.bookingCode).filter(Boolean));
  const reservedFromLedger: BillCardData[] = ledgerEntries
    .filter((entry) => (
      (isDepositOnly(entry) || entry.paymentStatus === "PACKAGE_SESSION")
      && (entry.serviceStatus === "RESERVED" || entry.isBusiness)
      && !completedBookingCodes.has(entry.bookingCode)
    ))
    .map((entry) => ({
      key: entry.id,
      status: "UNUSED",
      label: entry.label,
      bookingCode: entry.bookingCode ?? entry.id,
      branchLabel: entry.branchLabel,
      scheduledTime: entry.scheduledTime,
      totalAmount: entry.totalAmount,
      depositAmount: entry.paymentStatus === "PACKAGE_SESSION" ? 0 : entry.depositAmount ?? entry.amount,
      amount: entry.paymentStatus === "PACKAGE_SESSION" ? 0 : Math.max(0, (entry.totalAmount ?? entry.amount) - (entry.depositAmount ?? entry.amount)),
      note: entry.note,
      items: entry.items,
      paymentStatus: entry.paymentStatus,
      serviceStatus: "RESERVED",
      packageName: entry.packageName,
      isBusiness: entry.isBusiness || entry.label.toLocaleLowerCase("vi").includes("business"),
    }));
  return reservedFromLedger;
}

export function ExpenseSection({ detailed }: { detailed: boolean }) {
  const ledgerEntries = useWalletLedger();
  const { isExpanded, toggle } = useExpandToggle(detailed);

  const unusedBills = useUnusedBills();

  const inServiceBills: BillCardData[] = ledgerEntries
    .filter((entry) => entry.serviceStatus === "IN_SERVICE")
    .map((entry) => ({
        key: entry.id,
        status: "IN_SERVICE",
        label: entry.label,
        bookingCode: entry.bookingCode ?? entry.id,
        branchLabel: entry.branchLabel,
        therapistName: entry.therapistName,
        actualCheckinTime: entry.actualCheckinTime,
        checkoutRequestedAt: entry.checkoutRequestedAt,
        serviceDurationMin: entry.serviceDurationMin,
        totalAmount: entry.totalAmount,
        depositAmount: entry.depositAmount,
        amount: Math.max(0, (entry.totalAmount ?? 0) - (entry.depositAmount ?? 0)),
        isGroup: isMultiPerson(entry.items ?? []),
        items: entry.items,
        paymentStatus: entry.paymentStatus,
        serviceStatus: entry.serviceStatus,
        packageName: entry.packageName,
        isBusiness: entry.isBusiness,
      }));

  const attentionBills: BillCardData[] = ledgerEntries
    .filter((entry) => entry.serviceStatus === "CANCELLED" || entry.serviceStatus === "NO_SHOW")
    .map((entry) => ({
      key: entry.id,
      status: "ATTENTION",
      label: entry.label,
      bookingCode: entry.bookingCode ?? entry.id,
      branchLabel: entry.branchLabel,
      totalAmount: entry.totalAmount,
      depositAmount: entry.depositAmount,
      amount: entry.amount,
      note: entry.note,
      items: entry.items,
      paymentStatus: entry.paymentStatus,
      serviceStatus: entry.serviceStatus,
      packageName: entry.packageName,
    }));

  const completedFromLedger: BillCardData[] = ledgerEntries.filter(isCompletedLedgerEntry).map((entry) => ({
    key: entry.id,
    status: "COMPLETED",
    label: entry.label,
    bookingCode: entry.bookingCode ?? entry.id,
    therapistName: entry.therapistName,
    scheduledTime: entry.scheduledTime,
    actualCheckinTime: entry.actualCheckinTime,
    checkoutRequestedAt: entry.checkoutRequestedAt,
    checkoutDate: entry.date,
    checkoutTime: entry.time,
    serviceDurationMin: entry.serviceDurationMin,
    totalAmount: entry.totalAmount,
    depositAmount: entry.depositAmount,
    tipAmount: entry.tipAmount,
    refundAmount: entry.refundAmount,
    branchLabel: entry.branchLabel,
    items: entry.items,
    amount: entry.amount,
    note: entry.note,
    paymentStatus: entry.paymentStatus,
    serviceStatus: entry.serviceStatus,
    packageName: entry.packageName,
    isBusiness: entry.isBusiness,
  }));

  const completedBills: BillCardData[] = completedFromLedger;
  const refundEntries = ledgerEntries.filter((entry) => entry.paymentStatus === "REFUND");

  return (
    <section className="mt-4 space-y-5">
      <div>
        <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Hourglass size={15} className={inServiceBills.length ? "animate-pulse text-[#ad432f]" : "text-[#c59a3d]"} /> Đang diễn ra
          {inServiceBills.length ? <span className="rounded-full bg-[#ad432f] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">{inServiceBills.length} đang phục vụ</span> : null}
        </p>
        {inServiceBills.length > 0 || unusedBills.length > 0 ? (
          <div className="space-y-2.5">
            {inServiceBills.map((bill) => <BillCard key={bill.key} data={bill} expanded={isExpanded(bill.key)} onToggle={() => toggle(bill.key)} />)}
            {unusedBills.map((bill) => (
              <BillCard key={bill.key} data={bill} expanded={isExpanded(bill.key)} onToggle={() => toggle(bill.key)} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#e7d6ca] bg-white p-4 text-center text-xs text-[#826f66]">
            Không có đơn nào đang chờ sử dụng.
          </p>
        )}
      </div>

      {attentionBills.length > 0 ? (
        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[#76551d]">
            <Hourglass size={15} /> Cần theo dõi
          </p>
          <div className="space-y-2.5">
            {attentionBills.map((bill) => <BillCard key={bill.key} data={bill} expanded={isExpanded(bill.key)} onToggle={() => toggle(bill.key)} />)}
          </div>
        </div>
      ) : null}

      {refundEntries.length > 0 ? (
        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[#ad432f]">
            <RotateCcw size={15} /> Khoản tiền đã hoàn
          </p>
          <div className="space-y-2.5">
            {refundEntries.map((entry) => <div key={entry.id} className="rounded-xl border border-[#e8d2c4] bg-[#fff4e6] p-3.5">
              <div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm text-[#76551d]">{entry.label}</strong><small className="mt-1 block text-[10px] text-[#a85f29]">{entry.branchLabel}{entry.bookingCode ? ` · ${displayBookingCode(entry.bookingCode)}` : ""}</small></span><strong className="shrink-0 text-sm text-[#ad432f]">+{formatMoney(Math.abs(entry.amount))}</strong></div>
              <div className="mt-2 border-t border-dashed border-[#e8d2c4] pt-2 text-[10px] leading-4 text-[#a85f29]"><p>{entry.note}</p><p className="mt-1 font-medium">Đã chuyển lúc {entry.time} · {entry.date}</p></div>
            </div>)}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
          <Receipt size={15} className="text-[#c64b32]" /> Đã thanh toán & hoàn tất
        </p>
        <div className="space-y-2.5">
          {completedBills.map((bill) => (
            <BillCard key={bill.key} data={bill} expanded={isExpanded(bill.key)} onToggle={() => toggle(bill.key)} />
          ))}
        </div>
      </div>
    </section>
  );
}

const STATUS_CARD_STYLE: Record<BillStatus, string> = {
  UNUSED: "border-[#c59a3d] bg-[#fbf2e7]",
  IN_SERVICE: "border-2 border-[#ad432f] bg-gradient-to-br from-[#fff4e6] via-white to-[#fffaf6] shadow-[0_8px_22px_rgba(168,95,41,0.16)] ring-2 ring-[#e8d2c4]/60",
  COMPLETED: "border-[#e7d6ca] bg-white",
  ATTENTION: "border-[#e8d39e] bg-[#fffaf0]",
};

const STATUS_BADGE_STYLE: Record<BillStatus, string> = {
  UNUSED: "bg-[#c59a3d]/20 text-[#8a5a12]",
  IN_SERVICE: "bg-[#ad432f] text-white shadow-sm",
  COMPLETED: "bg-[#fff4e6] text-[#a85f29]",
  ATTENTION: "bg-[#f5e8bf] text-[#76551d]",
};

const EARLY_LATE_TOLERANCE_MIN = 6;

function scheduledTimeLabel(value?: string) {
  if (!value || !value.includes("T")) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).format(parsed);
}

export function BillCard({ data, expanded, onToggle }: { data: BillCardData; expanded: boolean; onToggle: () => void }) {
  const depositOnly = data.status === "UNUSED" && (data.paymentStatus === "DEPOSIT_ONLY" || Boolean(data.depositAmount));
  const packageSession = data.paymentStatus === "PACKAGE_SESSION";
  const refunded = data.paymentStatus === "REFUNDED" || data.paymentStatus === "PARTIALLY_REFUNDED";
  const paidInFull = data.status === "COMPLETED" && data.paymentStatus !== "PACKAGE_PURCHASE" && !refunded;
  const actualMinutes = computeActualServiceMinutes(data.actualCheckinTime, data.checkoutDate, data.checkoutTime);
  const overageMinutes = actualMinutes !== null && data.serviceDurationMin ? actualMinutes - data.serviceDurationMin : null;

  let durationStatusLabel: string | null = null;
  let durationStatusGood = true;
  if (overageMinutes !== null) {
    if (overageMinutes < -EARLY_LATE_TOLERANCE_MIN) {
      durationStatusLabel = `Ra sớm ${Math.abs(overageMinutes)} phút`;
      durationStatusGood = false;
    } else if (overageMinutes > EARLY_LATE_TOLERANCE_MIN) {
      durationStatusLabel = `Ra muộn ${overageMinutes} phút`;
      durationStatusGood = false;
    } else {
      durationStatusLabel = "Đúng thời lượng";
      durationStatusGood = true;
    }
  }

  function openCard() {
    onToggle();
  }

  return (
    <div className={cn("rounded-xl border p-3.5 transition", STATUS_CARD_STYLE[data.status])}>
      <button type="button" onClick={openCard} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn("truncate text-sm font-semibold", data.status === "IN_SERVICE" && "text-[#76551d]")}>{data.label}</span>
            {data.isGroup ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#51423b]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#51423b]">
                <Users size={9} /> Nhóm
              </span>
            ) : null}
          </span>
          <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE_STYLE[data.status])}>
            {packageSession ? `${data.status === "COMPLETED" ? "Đã hoàn tất" : "Đã giữ lượt"} · ${data.packageName ?? "Gói thành viên"}` : refunded ? (data.paymentStatus === "REFUNDED" ? "Đã hoàn toàn bộ khoản thu" : "Đã hoàn một phần") : data.status === "ATTENTION" ? (data.serviceStatus === "NO_SHOW" ? "Vắng hẹn · Cần xử lý" : "Đã hủy · Cần xử lý") : data.checkoutRequestedAt ? "Đã check-out sớm · Chờ quầy hoàn tất" : depositOnly ? "Đã đặt cọc · Chưa hoàn tất dịch vụ" : paidInFull ? "Đã hoàn tất · Thanh toán đủ" : billStatusLabel(data.status)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className={cn("text-sm font-semibold", data.status === "COMPLETED" ? "text-[#c64b32]" : "text-[#281b18]")}>
              {packageSession ? `${data.items?.length ?? 1} lượt` : <>{data.status === "COMPLETED" || depositOnly ? "-" : ""}{formatMoney(depositOnly ? (data.depositAmount ?? data.amount) : data.status === "COMPLETED" ? (data.totalAmount ?? data.amount) : data.amount)}</>}
            </span>
            <ChevronDown size={14} className={cn("text-[#826f66] transition", expanded && "rotate-180")} />
          </span>
          <span className="text-[9px] text-[#826f66]">{packageSession ? "Không phát sinh thanh toán mới" : depositOnly ? "Tiền cọc đã thanh toán" : paidInFull ? "Toàn bộ hóa đơn đã thanh toán" : data.status === "COMPLETED" ? "Đã thanh toán" : "Cần thanh toán"}</span>
        </span>
      </button>

      {data.status === "IN_SERVICE" && !data.isBusiness ? <p className="mt-2.5 rounded-xl bg-[#fff7df] px-3 py-2.5 text-center text-[11px] leading-5 text-[#715943]">Lễ tân đang theo dõi ca và sẽ xác nhận check-out, thanh toán khi kết thúc.</p> : null}

      {expanded ? (
        <div className="mt-2.5 space-y-1 border-t border-dashed border-[#e7d6ca] pt-2.5 text-[11px] text-[#826f66]">
          {data.items && data.items.length > 0 ? (
            <div className="space-y-1 pb-1">
              {data.items.map((line) => (
                <div key={line.name} className="flex items-center justify-between gap-3">
                  <span className="text-[#51423b]">
                    {line.name}
                    {line.qty > 1 ? ` x${line.qty}` : ""}
                  </span>
                  <span className="font-medium text-[#51423b]">{formatMoney(line.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {data.totalAmount ? (
            <div className="flex items-center justify-between gap-3">
              <span>Tổng hoá đơn</span>
              <span className="font-medium text-[#51423b]">{formatMoney(data.totalAmount)}</span>
            </div>
          ) : null}
          {data.depositAmount ? (
            <div className="flex items-center justify-between gap-3">
              <span>Đã đặt cọc</span>
              <span className="font-medium text-[#a85f29]">{formatMoney(data.depositAmount)}</span>
            </div>
          ) : null}
          {paidInFull && data.totalAmount && data.depositAmount ? (
            <div className="flex items-center justify-between gap-3">
              <span>Thanh toán khi hoàn tất</span>
              <span className="font-medium text-[#51423b]">{formatMoney(Math.max(0, data.totalAmount - data.depositAmount))}</span>
            </div>
          ) : null}
          {paidInFull && data.tipAmount ? (
            <div className="flex items-center justify-between gap-3 text-[#76551d]">
              <span>Tip KTV ngoài bill</span>
              <span className="font-semibold">{formatMoney(data.tipAmount)}</span>
            </div>
          ) : null}
          {refunded && data.refundAmount ? (
            <><div className="flex items-center justify-between gap-3 text-[#ad432f]"><span>Đã được hoàn qua ngân hàng</span><span className="font-semibold">+{formatMoney(data.refundAmount)}</span></div><div className="flex items-center justify-between gap-3"><span>Chi phí ròng sau hoàn</span><span className="font-semibold text-[#51423b]">{formatMoney(Math.max(0, (data.totalAmount ?? data.amount) - data.refundAmount))}</span></div></>
          ) : null}
          {(depositOnly || data.status === "IN_SERVICE") && data.totalAmount ? (
            <div className="flex items-center justify-between gap-3">
              <span>Còn thanh toán sau dịch vụ</span>
              <span className="font-semibold text-[#c64b32]">{formatMoney(Math.max(0, data.totalAmount - (data.depositAmount ?? 0)))}</span>
            </div>
          ) : null}
          {paidInFull ? (
            <div className="flex items-center justify-between gap-3">
              <span>Còn phải thanh toán</span>
              <span className="font-semibold text-[#a85f29]">0 ₫ · Đã đối soát đủ</span>
            </div>
          ) : null}
          {data.therapistName ? (
            <div className="flex items-center justify-between gap-3">
              <span>KTV thực hiện</span>
              <span className="font-medium text-[#51423b]">{data.therapistName}</span>
            </div>
          ) : null}
          {data.branchLabel ? (
            <div className="flex items-center justify-between gap-3">
              <span>Cơ sở</span>
              <span className="font-medium text-[#51423b]">{data.branchLabel}</span>
            </div>
          ) : null}
          {data.scheduledTime ? (
            <div className="flex items-center justify-between gap-3">
              <span>Giờ hẹn</span>
              <span className="font-medium text-[#51423b]">{scheduledTimeLabel(data.scheduledTime)}</span>
            </div>
          ) : null}
          {data.actualCheckinTime ? (
            <div className="flex items-center justify-between gap-3">
              <span>Giờ check-in</span>
              <span className="font-medium text-[#51423b]">{data.actualCheckinTime}</span>
            </div>
          ) : null}
          {data.checkoutDate ? (
            <div className="flex items-center justify-between gap-3">
              <span>Giờ thanh toán (check-out)</span>
              <span className="font-medium text-[#51423b]">
                {data.checkoutDate}
                {data.checkoutTime ? ` · ${data.checkoutTime}` : ""}
              </span>
            </div>
          ) : null}
          {data.serviceDurationMin ? (
            <div className="flex items-center justify-between gap-3">
              <span>Thời lượng gói</span>
              <span className="font-medium text-[#51423b]">{data.serviceDurationMin} phút</span>
            </div>
          ) : null}
          {actualMinutes !== null ? (
            <div className="flex items-center justify-between gap-3">
              <span>Thời lượng thực tế</span>
              <span className="font-medium text-[#51423b]">{actualMinutes} phút</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span>Mã đơn</span>
            <span className="font-medium text-[#51423b]">{displayBookingCode(data.bookingCode)}</span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-1">
            <span className="min-w-0 justify-self-start">
              {data.note ? (
                <span className="inline-flex rounded-full bg-[#f8ebe5] px-2 py-0.5 text-[10px] font-semibold text-[#c64b32]">
                  {data.note}
                </span>
              ) : null}
            </span>
            <span className="justify-self-end text-right">
              {durationStatusLabel ? (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    durationStatusGood ? "bg-[#fff4e6] text-[#a85f29]" : "bg-[#f8ebe5] text-[#c64b32]"
                  )}
                >
                  {durationStatusLabel}
                </span>
              ) : null}
            </span>
          </div>

          {data.status === "UNUSED" && data.isBusiness ? (
            <Link
              href={`/doanh-nghiep/${data.bookingCode}`}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#3d1f12] px-4 py-2.5 text-xs font-semibold text-[#e7c878]"
            >
              <Briefcase size={13} /> Xem yêu cầu Tâm An Business
            </Link>
          ) : data.status === "UNUSED" ? (
            <p className="mt-2 rounded-xl bg-[#fff7df] px-3 py-2.5 text-center text-[11px] leading-5 text-[#715943]">Khi đến, đọc họ tên và số điện thoại để lễ tân tiếp nhận.</p>
          ) : null}
          {data.status === "IN_SERVICE" && data.isBusiness ? (
            <Link
              href={`/doanh-nghiep/${data.bookingCode}`}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#3d1f12] px-4 py-2.5 text-xs font-semibold text-[#e7c878]"
            >
              <Briefcase size={13} /> Xem đồng hồ Tâm An Business
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
