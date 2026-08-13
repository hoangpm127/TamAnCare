"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  PackagePlus,
  QrCode,
  UserRound,
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
  const router = useRouter();
  const params = useSearchParams();
  const membership = useMembership();
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [firstVisitEligible, setFirstVisitEligible] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(() => params.get("plan") ?? "");
  const [step, setStep] = useState<PurchaseStep>("select");
  const [paymentError, setPaymentError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPackagePayment | null>(null);
  const [referrer, setReferrer] = useState("");
  const packagePlans = catalog?.packagePlans ?? EMPTY_PLANS;
  const vouchers = catalog?.vouchers ?? EMPTY_VOUCHERS;
  const selectedPlan = packagePlans.find((plan) => plan.id === selectedPlanId);
  const selectedPlanService = catalog?.services.find((service) => service.id === selectedPlan?.serviceId);
  const packageGroups = useMemo(() => {
    const durationByService = new Map(catalog?.services.map((service) => [service.id, service.durationMin]) ?? []);
    const grouped = new Map<number | null, typeof packagePlans>();
    for (const plan of packagePlans) {
      const duration = plan.serviceId ? durationByService.get(plan.serviceId) ?? null : null;
      grouped.set(duration, [...(grouped.get(duration) ?? []), plan]);
    }
    return [...grouped.entries()]
      .sort(([durationA], [durationB]) => (durationA ?? Number.MAX_SAFE_INTEGER) - (durationB ?? Number.MAX_SAFE_INTEGER))
      .map(([duration, plans]) => ({
        duration,
        plans: [...plans].sort((a, b) => a.sessions - b.sessions || a.price - b.price),
      }));
  }, [catalog?.services, packagePlans]);

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
        body: JSON.stringify({ planId: selectedPlan.id, paymentCode, referrer: referrer.trim() || undefined }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push(`/tai-khoan?returnTo=${encodeURIComponent(`/uu-dai?plan=${selectedPlan.id}`)}`);
        return;
      }
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
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#281b18] sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <Gift className="text-[#c64b32]" size={20} />
        <h1 className="text-xl font-semibold tracking-tight">Ưu đãi dành cho bạn</h1>
      </div>

      {!catalog && !catalogError ? <p className="mb-4 rounded-xl bg-white p-4 text-center text-sm text-[#68574f]">Đang tải ưu đãi từ hệ thống…</p> : null}
      {catalogError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-red-700">{catalogError}</p> : null}

      {membership ? (
        <Link
          href="/toi"
          className="mb-4 flex items-center gap-3 rounded-xl border border-[#c59a3d]/40 bg-gradient-to-br from-[#fbf2e7] to-white p-3.5 shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5c3a1e] text-[#c59a3d]">
            <CreditCard size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Thẻ {membership.planName} đang hoạt động</span>
            <span className="block text-xs text-[#826f66]">
              Còn {membership.availableSessions}/{membership.totalSessions} buổi · {membership.reservedSessions > 0 ? `${membership.reservedSessions} lượt đang giữ · ` : ""}HSD {membership.expiresAt}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" />
        </Link>
      ) : null}

      <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
        <PackagePlus size={16} className="text-[#c64b32]" /> Gói dài hạn — càng mua nhiều, càng tiết kiệm
      </p>
      <p className="mb-3 text-xs leading-5 text-[#826f66]">
        Thanh toán một lần qua VietQR; thẻ chỉ kích hoạt sau khi SePay xác nhận. Mỗi lượt áp dụng đúng dịch vụ ghi trên gói và không cộng thêm voucher.
      </p>
      <div className="space-y-3">
        {packageGroups.map((group) => (
          <section key={group.duration ?? "other"} className="rounded-xl border border-[#eadbd1] bg-[#fffaf6] p-2.5">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <p className="text-xs font-semibold text-[#5c3a1e]">
                {group.duration ? `Massage Body ${group.duration} phút` : "Gói liệu trình khác"}
              </p>
              <span className="text-[10px] text-[#8a756b]">5 · 10 · 15 buổi</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {group.plans.map((plan) => {
                const totalSessions = plan.paidSessions + plan.bonusSessions;
                const pricePerSession = Math.round(plan.price / totalSessions);
                const selected = selectedPlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => choosePlan(plan.id)}
                    className={cn(
                      "relative flex min-h-[178px] flex-col items-center justify-center overflow-hidden rounded-xl border px-1.5 py-2 text-center transition",
                      selected
                        ? "border-[#c64b32] bg-[#f8ebe5] shadow-sm"
                        : plan.highlight
                          ? "border-[#c59a3d] bg-gradient-to-br from-[#fbf2e7] to-white"
                          : "border-[#e7d6ca] bg-white"
                    )}
                  >
                    <span className="mx-auto mb-1 block max-w-full truncate rounded-full bg-[#5c3a1e] px-1.5 py-0.5 text-[8px] font-semibold leading-4 text-[#c59a3d]">
                      {plan.badge ?? "Gói linh hoạt"}
                    </span>
                    <p className="line-clamp-2 min-h-8 text-[12px] font-semibold leading-4">{plan.name}</p>
                    <div className="mt-1 grid w-full grid-cols-2 gap-0.5 rounded-lg bg-white/80 px-1 py-1 text-[8px] text-[#715943] ring-1 ring-[#e7d6ca]/70">
                      <span>
                        <strong className="block text-xs text-[#4a2d16]">{plan.bonusSessions > 0 ? `${plan.paidSessions}+${plan.bonusSessions}` : plan.sessions}</strong>
                        Lượt dùng
                      </span>
                      <span><strong className="block text-xs text-[#4a2d16]">{plan.validityDays}</strong> Ngày</span>
                    </div>
                    <div className="mt-1.5">
                      <p className="text-[13px] font-bold text-[#c64b32]">{formatMoney(plan.price)}</p>
                      <p className="text-[8px] text-[#826f66]">~{formatMoney(pricePerSession)}/buổi</p>
                      <p className="mt-0.5 text-[8px] font-medium text-[#7c2927]">{plan.shareable ? "Dùng cho nhóm" : "Dành cho chủ thẻ"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selectedPlan ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#c59a3d] bg-[#fbf2e7]">
          {step === "select" ? (
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#5c3a1e]">
                <CreditCard size={16} className="shrink-0" /> Kích hoạt thẻ {selectedPlan.name}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#826f66]">
                  Thanh toán đủ {formatMoney(selectedPlan.price)} để kích hoạt thẻ ngay — hệ thống ghi nhớ hạng thẻ và lễ tân xác nhận trừ buổi
                khi bạn sử dụng dịch vụ, không cần đặt cọc riêng lẻ từng buổi.
              </p>
              <div className="mt-2.5 space-y-1.5 rounded-xl border border-[#e7d6ca] bg-white p-3 text-[11px] leading-5 text-[#68574f]">
                <p><strong className="text-[#4a2d16]">Dịch vụ:</strong> {selectedPlanService?.name ?? "Theo dịch vụ ghi trên thẻ"}</p>
                <p>
                  <strong className="text-[#4a2d16]">Quyền lợi:</strong>{" "}
                  {selectedPlan.bonusSessions > 0
                    ? `${selectedPlan.paidSessions} buổi mua + ${selectedPlan.bonusSessions} buổi tặng · tổng ${selectedPlan.sessions} buổi.`
                    : `${selectedPlan.sessions} buổi theo liệu trình.`}
                </p>
                <p><strong className="text-[#4a2d16]">Sử dụng:</strong> {selectedPlan.shareable ? "Chủ thẻ có thể đặt nhóm trong cùng booking." : "Chỉ dùng cho chủ thẻ, không chuyển nhượng."}</p>
                <p><strong className="text-[#4a2d16]">Hiệu lực:</strong> {selectedPlan.validityDays} ngày tính từ lúc ngân hàng xác nhận thanh toán.</p>
                {selectedPlan.description ? <p><strong className="text-[#4a2d16]">Thông tin thêm:</strong> {selectedPlan.description}</p> : null}
              </div>
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span className="text-xs text-[#826f66]">Số tiền kích hoạt</span>
                <span className="text-base font-bold text-[#c64b32]">{formatMoney(selectedPlan.price)}</span>
              </div>
              <label className="mt-2.5 block rounded-xl border border-[#e7d6ca] bg-white p-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4a2d16]">
                  <UserRound size={14} /> Người giới thiệu <span className="font-normal text-[#9a8378]">(không bắt buộc)</span>
                </span>
                <input
                  value={referrer}
                  onChange={(event) => setReferrer(event.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  className="mt-2 h-10 w-full rounded-lg border border-[#e3d6ce] bg-[#fffdfa] px-3 text-xs outline-none focus:border-[#c64b32]"
                  placeholder="Tên, số điện thoại hoặc mã Affiliate"
                />
                <span className="mt-1.5 block text-[10px] leading-4 text-[#826f66]">Tâm An lưu thông tin này cùng giao dịch để đối soát minh bạch.</span>
              </label>
              {paymentError ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{paymentError}</p> : null}
              <button
                type="button"
                onClick={() => void preparePayment()}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#b6403a] to-[#8b2b28] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/15"
              >
                Thanh toán qua chuyển khoản
              </button>
            </div>
          ) : null}

          {step === "bank" ? (
            <div className="flex flex-col items-center gap-2.5 p-8 text-center">
              <Loader2 className="animate-spin text-[#c64b32]" size={28} />
              <p className="text-sm font-semibold text-[#5c3a1e]">Đang tạo VietQR thanh toán…</p>
              <p className="text-xs text-[#826f66]">Mã sẽ có sẵn số tiền và nội dung đối soát SePay.</p>
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
              <Loader2 className="animate-spin text-[#c64b32]" size={28} />
              <p className="text-sm font-semibold text-[#5c3a1e]">Đang chờ ngân hàng đối soát qua SePay...</p>
              <p className="text-xs text-[#826f66]">Thẻ chưa được kích hoạt chỉ dựa trên thao tác bấm nút.</p>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <CheckCircle2 className="text-[#a85f29]" size={32} />
              <p className="text-sm font-semibold text-[#8a4f14]">Đã kích hoạt thẻ {selectedPlan.name}!</p>
              <p className="text-xs leading-5 text-[#826f66]">
                Thẻ có {selectedPlan.paidSessions + selectedPlan.bonusSessions} buổi, hạn dùng {selectedPlan.validityDays} ngày. Hệ
                  thống sẽ trừ buổi sau khi lễ tân xác nhận bạn đã sử dụng dịch vụ tại quán.
              </p>
                <div className="mt-1.5 flex gap-2">
                  <Link href="/toi" className="rounded-full border border-[#c64b32] px-4 py-2 text-xs font-semibold text-[#c64b32]">
                    Xem thẻ trong Tôi
                  </Link>
                  <Link href="/booking" className="rounded-full bg-[#c64b32] px-4 py-2 text-xs font-semibold text-white">
                    Đặt lịch sử dụng thẻ
                  </Link>
                </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mb-1 mt-5 text-sm font-semibold">Voucher & mã giảm giá</p>
      <p className="mb-2.5 truncate text-xs text-[#826f66]">Ưu đãi phù hợp theo khung giờ và nhu cầu của bạn.</p>
      <div className="grid grid-cols-2 gap-3">
        {vouchers.filter((voucher) => voucher.code !== "AFF50" && (firstVisitEligible || voucher.code !== "FIRST60")).map((voucher) => (
          <VoucherCard key={voucher.code} voucher={voucher} compact />
        ))}
      </div>
    </main>
  );
}

export default function OffersPage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-3xl bg-[#fdf8f3] px-4 pb-6 pt-3 sm:px-6" />}>
      <OffersContent />
    </Suspense>
  );
}
