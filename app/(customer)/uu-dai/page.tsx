"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  PackagePlus,
  QrCode,
} from "lucide-react";
import type { PublicCatalog } from "@/lib/catalog-types";
import { activateMembership, useMembership } from "@/lib/membership";
import { refreshWalletLedger } from "@/lib/wallet-ledger";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import { VoucherCard } from "@/components/voucher-card";
import { cn, formatMoney, makeBookingCode } from "@/lib/utils";

type PurchaseStep = "select" | "bank" | "bill" | "confirming" | "done";
type PendingPackagePayment = { id: string; status: string; amount: number; paymentCode?: string | null };
const EMPTY_PLANS: PublicCatalog["packagePlans"] = [];
const EMPTY_VOUCHERS: PublicCatalog["vouchers"] = [];

function OffersContent() {
  const params = useSearchParams();
  const membership = useMembership();
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [firstVisitEligible, setFirstVisitEligible] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(() => params.get("plan") ?? "");
  const [step, setStep] = useState<PurchaseStep>("select");
  const [paymentError, setPaymentError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPackagePayment | null>(null);
  const packagePlans = catalog?.packagePlans ?? EMPTY_PLANS;
  const vouchers = catalog?.vouchers ?? EMPTY_VOUCHERS;
  const selectedPlan = packagePlans.find((plan) => plan.id === selectedPlanId);
  const recommendedPlans = useMemo(() => [...packagePlans].sort((a, b) => a.price - b.price), [packagePlans]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/catalog", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Không tải được danh mục ưu đãi."))),
      fetch("/api/customer-auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : { account: null }),
    ])
      .then(([catalogData, sessionData]) => {
        if (!active) return;
        setCatalog(catalogData as PublicCatalog);
        setFirstVisitEligible(!sessionData.account || sessionData.account.totalVisits === 0);
      })
      .catch((error) => {
        if (active) setCatalogError(error instanceof Error ? error.message : "Không tải được danh mục ưu đãi.");
      });
    return () => { active = false; };
  }, []);

  function choosePlan(id: string) {
    const next = selectedPlanId === id ? "" : id;
    setSelectedPlanId(next);
    setStep("select");
    setPendingPayment(null);
  }

  const activateConfirmedPackage = useCallback(() => {
    if (!selectedPlan) return;
    activateMembership({
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      badge: selectedPlan.badge ?? "Gói thành viên",
      totalSessions: selectedPlan.paidSessions + selectedPlan.bonusSessions,
      usedSessions: 0,
      purchasedAt: format(new Date(), "dd/MM/yyyy"),
      expiresAt: format(addDays(new Date(), selectedPlan.validityDays), "dd/MM/yyyy"),
    });
    void refreshWalletLedger();
    setStep("done");
  }, [selectedPlan]);

  useEffect(() => {
    if (!pendingPayment || !["bill", "confirming"].includes(step)) return;
    let active = true;
    async function poll() {
      const response = await fetch(`/api/payments/${encodeURIComponent(pendingPayment!.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (!active) return;
      if (data.payment?.status === "CONFIRMED" && data.payment?.packageStatus === "ACTIVE") activateConfirmedPackage();
    }
    queueMicrotask(() => void poll());
    const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activateConfirmedPackage, pendingPayment, step]);

  async function preparePayment() {
    if (!selectedPlan) return;
    setStep("bank");
    setPaymentError("");
    const paymentCode = makeBookingCode("PKG");
    try {
      const response = await fetch("/api/packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, paymentCode }),
      });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể tạo yêu cầu mua gói.");
      setPendingPayment(data.payment as PendingPackagePayment);
      if (data.payment?.status === "CONFIRMED" && data.packageStatus === "ACTIVE") activateConfirmedPackage();
      else setStep("bill");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không thể tạo yêu cầu mua gói.");
      setStep("select");
    }
  }

  function confirmPayment() {
    setStep("confirming");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <Gift className="text-[#d13f1f]" size={20} />
        <h1 className="text-xl font-semibold tracking-tight">Ưu đãi dành cho bạn</h1>
      </div>

      {!catalog && !catalogError ? <p className="mb-4 rounded-xl bg-white p-4 text-center text-sm text-[#665b55]">Đang tải ưu đãi từ hệ thống…</p> : null}
      {catalogError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-red-700">{catalogError}</p> : null}

      {membership ? (
        <Link
          href="/toi"
          className="mb-4 flex items-center gap-3 rounded-xl border border-[#e3b23c]/40 bg-gradient-to-br from-[#fff7ec] to-white p-3.5 shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#e3b23c]">
            <CreditCard size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Thẻ {membership.planName} đang hoạt động</span>
            <span className="block text-xs text-[#8a7a72]">
              Còn {membership.availableSessions}/{membership.totalSessions} buổi · {membership.reservedSessions > 0 ? `${membership.reservedSessions} lượt đang giữ · ` : ""}HSD {membership.expiresAt}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" />
        </Link>
      ) : null}

      <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
        <PackagePlus size={16} className="text-[#d13f1f]" /> Gói dài hạn — càng mua nhiều, càng tiết kiệm
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {recommendedPlans.map((plan) => {
          const totalSessions = plan.paidSessions + plan.bonusSessions;
          const pricePerSession = Math.round(plan.price / totalSessions);
          const selected = selectedPlanId === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => choosePlan(plan.id)}
              className={cn(
                "relative flex aspect-square min-h-0 flex-col items-center justify-center overflow-hidden rounded-xl border p-2.5 text-center transition",
                selected
                  ? "border-[#d13f1f] bg-[#fff2ef]"
                  : plan.highlight
                    ? "border-[#e3b23c] bg-gradient-to-br from-[#fff7ec] to-white"
                    : "border-[#eadbd1] bg-white"
              )}
            >
              <span className="mx-auto mb-1 block max-w-full truncate rounded-full bg-[#5c3a1e] px-2 py-0.5 text-[8px] font-semibold leading-4 text-[#e3b23c]">
                {plan.badge ?? "Gói linh hoạt"}
              </span>
              <p className="line-clamp-2 min-h-8 text-[13px] font-semibold leading-4">{plan.name}</p>
              <div className="mt-1 grid w-full grid-cols-2 gap-1 rounded-lg bg-white/80 px-1.5 py-1 text-[9px] text-[#715943] ring-1 ring-[#eadbd1]/70">
                <span><strong className="block text-xs text-[#4a2d16]">{totalSessions}</strong> Lượt sử dụng</span>
                <span><strong className="block text-xs text-[#4a2d16]">{plan.validityDays}</strong> Ngày hiệu lực</span>
              </div>
              <div className="mt-1.5">
                <p className="text-sm font-bold text-[#d13f1f]">{formatMoney(plan.price)}</p>
                <p className="text-[9px] text-[#8a7a72]">~{formatMoney(pricePerSession)}/buổi</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPlan ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#e3b23c] bg-[#fff7ec]">
          {step === "select" ? (
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#5c3a1e]">
                <CreditCard size={16} className="shrink-0" /> Kích hoạt thẻ {selectedPlan.name}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#8a7a72]">
                Thanh toán đủ {formatMoney(selectedPlan.price)} để kích hoạt thẻ ngay — hệ thống ghi nhớ hạng thẻ và tự động trừ buổi
                mỗi lần check-in, không cần đặt cọc riêng lẻ từng buổi.
              </p>
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span className="text-xs text-[#8a7a72]">Số tiền kích hoạt</span>
                <span className="text-base font-bold text-[#d13f1f]">{formatMoney(selectedPlan.price)}</span>
              </div>
              <button
                type="button"
                onClick={() => void preparePayment()}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#c22630] to-[#8f151a] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/15"
              >
                Thanh toán qua chuyển khoản
              </button>
            </div>
          ) : null}

          {step === "bank" ? (
            <div className="flex flex-col items-center gap-2.5 p-8 text-center">
              <Loader2 className="animate-spin text-[#d13f1f]" size={28} />
              <p className="text-sm font-semibold text-[#5c3a1e]">Đang tạo VietQR thanh toán…</p>
              <p className="text-xs text-[#8a7a72]">Mã sẽ có sẵn số tiền và nội dung đối soát SePay.</p>
            </div>
          ) : null}

          {step === "bill" ? (
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#5c3a1e]">
                <QrCode size={16} className="shrink-0" /> Chuyển khoản {formatMoney(selectedPlan.price)}
              </p>
              <BankTransferDetails
                amount={selectedPlan.price}
                transferContent={pendingPayment?.paymentCode ?? ""}
                onConfirm={confirmPayment}
                helperText="SePay sẽ tự động xác nhận và kích hoạt thẻ sau khi nhận giao dịch."
              />
              {paymentError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{paymentError}</p> : null}
            </div>
          ) : null}

          {step === "confirming" ? (
            <div className="flex flex-col items-center gap-2.5 p-8 text-center">
              <Loader2 className="animate-spin text-[#d13f1f]" size={28} />
              <p className="text-sm font-semibold text-[#5c3a1e]">Đang chờ ngân hàng đối soát qua SePay...</p>
              <p className="text-xs text-[#8a7a72]">Thẻ chưa được kích hoạt chỉ dựa trên thao tác bấm nút.</p>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <CheckCircle2 className="text-[#1d8f55]" size={32} />
              <p className="text-sm font-semibold text-[#1d8f55]">Đã kích hoạt thẻ {selectedPlan.name}!</p>
              <p className="text-xs leading-5 text-[#8a7a72]">
                Thẻ có {selectedPlan.paidSessions + selectedPlan.bonusSessions} buổi, hạn dùng {selectedPlan.validityDays} ngày. Hệ
                thống sẽ tự động trừ buổi mỗi lần bạn check-in tại quán.
              </p>
              <div className="mt-1.5 flex gap-2">
                <Link href="/toi" className="rounded-full border border-[#d13f1f] px-4 py-2 text-xs font-semibold text-[#d13f1f]">
                  Xem thẻ trong Tôi
                </Link>
                <Link href="/check-in" className="rounded-full bg-[#d13f1f] px-4 py-2 text-xs font-semibold text-white">
                  Mở QR Check-in
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mb-1 mt-5 text-sm font-semibold">Voucher & mã giảm giá</p>
      <p className="mb-2.5 truncate text-xs text-[#8a7a72]">Ưu đãi phù hợp theo khung giờ và nhu cầu của bạn.</p>
      <div className="grid grid-cols-2 gap-3">
        {vouchers.filter((voucher) => firstVisitEligible || voucher.code !== "FIRST60").map((voucher) => (
          <VoucherCard key={voucher.code} voucher={voucher} compact />
        ))}
      </div>
    </main>
  );
}

export default function OffersPage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-3xl bg-[#fffaf6] px-4 pb-6 pt-3 sm:px-6" />}>
      <OffersContent />
    </Suspense>
  );
}
