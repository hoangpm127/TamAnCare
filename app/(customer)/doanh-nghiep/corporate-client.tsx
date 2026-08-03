"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Gift,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Plus,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import {
  branches as defaultBranches,
  corporatePackageTiers as defaultPackageTiers,
  corporateTrialPackages as defaultTrialPackages,
  corporateTransportFee as defaultTransportFee,
  depositPolicy as defaultDepositPolicy,
} from "@/lib/demo-data";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import { CompactSelect } from "@/components/compact-select";
import { cn, formatMoney, makeBookingCode } from "@/lib/utils";
import { calculatePaymentBreakdown } from "@/lib/payment-policy";
import { useBusinessCatalog } from "@/lib/business-catalog-store";
import { usePublicCatalog } from "@/lib/catalog-store";

const TIME_WINDOWS = ["11:00 - 12:00", "11:30 - 12:30", "12:00 - 13:00", "12:30 - 13:30", "13:00 - 14:00"];

type Stage = "form" | "deposit" | "payment" | "confirming" | "done";
type CorporatePayment = { id: string; status: string; amount: number; paymentCode?: string | null };

export function CorporateClient() {
  const searchParams = useSearchParams();
  const publicCatalog = usePublicCatalog();
  const runtimeBusinessCatalog = useBusinessCatalog();
  const branches = publicCatalog?.branches ?? defaultBranches;
  const corporateTrialPackages = runtimeBusinessCatalog?.trialPackages ?? defaultTrialPackages;
  const corporatePackageTiers = runtimeBusinessCatalog?.packageTiers ?? defaultPackageTiers;
  const corporateTransportFee = runtimeBusinessCatalog?.transportFee ?? defaultTransportFee;
  const depositPolicy = runtimeBusinessCatalog?.depositPolicy ?? defaultDepositPolicy;

  const [companyName, setCompanyName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[1]);
  const [headcount, setHeadcount] = useState(10);

  const [trialId, setTrialId] = useState(defaultTrialPackages[1].id);
  const [wantsCorporatePackage, setWantsCorporatePackage] = useState(false);
  const [tierId, setTierId] = useState(defaultPackageTiers[1].id);

  const [stage, setStage] = useState<Stage>("form");
  const [inquiryCode, setInquiryCode] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<CorporatePayment | null>(null);
  const [persistedEventCode, setPersistedEventCode] = useState("");

  const trial = corporateTrialPackages.find((item) => item.id === trialId) ?? corporateTrialPackages[0];
  const tier = corporatePackageTiers.find((item) => item.id === tierId) ?? corporatePackageTiers[0];

  const subtotal = headcount * trial.pricePerPerson;
  const discount = wantsCorporatePackage ? Math.round((subtotal * tier.discountPercent) / 100) : 0;

  const capacityPerTherapist = Math.max(1, Math.floor(60 / trial.durationMin));
  const requiredTherapists = Math.max(1, Math.ceil(headcount / capacityPerTherapist));
  const transportFree = wantsCorporatePackage && tier.id === "corp-complete";
  const transportFee = transportFree ? 0 : requiredTherapists * corporateTransportFee.feePerTherapist;

  const paymentBreakdown = calculatePaymentBreakdown({
    originalAmount: subtotal + transportFee,
    discountAmount: discount,
    depositPercent: depositPolicy.percent,
  });
  const total = paymentBreakdown.totalAmount;
  const depositAmount = paymentBreakdown.depositAmount;
  const amountDueOnsite = paymentBreakdown.balanceAmount;

  const headcountTooLow = wantsCorporatePackage && headcount < tier.minHeadcountPerSession;
  const headcountTooHigh = wantsCorporatePackage && headcount > tier.maxHeadcountPerSession;

  const canSubmit = Boolean(
    companyName.trim() &&
      taxCode.trim() &&
      officeAddress.trim() &&
      contactName.trim() &&
      contactPhone.trim() &&
      date &&
      headcount > 0 &&
      !headcountTooLow &&
      !headcountTooHigh
  );

  function goToQuote() {
    if (!canSubmit) return;
    const code = makeBookingCode("DN");
    setInquiryCode(code);
    setStage("deposit");
  }

  useEffect(() => {
    if (!pendingPayment || !["payment", "confirming"].includes(stage)) return;
    let active = true;
    async function poll() {
      const response = await fetch(`/api/payments/${encodeURIComponent(pendingPayment!.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (active && data.payment?.status === "CONFIRMED") setStage("done");
    }
    queueMicrotask(() => void poll());
    const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pendingPayment, stage]);

  async function prepareDeposit() {
    setStage("payment");
    setSubmitError("");
    try {
      const response = await fetch("/api/corporate-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryCode,
          companyName,
          taxCode,
          officeAddress,
          contactName,
          contactPhone,
          startsAt: new Date(`${date}T${timeWindow.slice(0, 5)}:00+07:00`).toISOString(),
          timeWindow,
          headcount,
          durationMin: trial.durationMin,
          trialId: trial.id,
          wantsCorporatePackage,
          tierId: wantsCorporatePackage ? tier.id : undefined,
          serviceLabel: trial.name,
          packageTier: wantsCorporatePackage ? tier.name : undefined,
          totalAmount: total,
          depositAmount,
          referralCode: searchParams.get("ref") || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.persisted) throw new Error(data.error ?? "Không thể tạo yêu cầu cọc Business.");
      setPendingPayment(data.payment as CorporatePayment);
      setPersistedEventCode(data.eventCode ?? inquiryCode);
      if (data.payment?.status === "CONFIRMED") setStage("done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể tạo yêu cầu cọc Business.");
      setStage("payment");
    }
  }

  async function confirmDeposit() {
    setStage("confirming");
    setSubmitError("");
    if (!pendingPayment) return;
    try {
      const response = await fetch(`/api/payments/${encodeURIComponent(pendingPayment.id)}/simulate`, { method: "POST" });
      if (response.ok) {
        setStage("done");
        return;
      }
      // 404 là chế độ chạy thật: tiếp tục chờ webhook SePay thay vì giả lập giao dịch.
      if (response.status === 404) return;
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Ngân hàng chưa thể đối soát khoản cọc.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Chưa thể kiểm tra khoản cọc.");
      setStage("payment");
    }
  }

  if (stage === "done") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecd2b4_0,#fdf8f3_42%,#f7ede5_100%)] px-4 py-8 text-[#281b18] sm:px-6">
        <section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#e7d6ca] bg-white shadow-lg">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#a85f29] via-[#8b2b28] to-[#4c191b] px-6 pb-8 pt-7 text-center text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <Check size={30} />
            </span>
            <h1 className="relative mt-3 text-xl font-semibold tracking-tight">Đặt dịch vụ thành công!</h1>
            <p className="relative mt-1.5 text-sm text-white/85">
              Mã yêu cầu <strong className="font-mono text-white">{inquiryCode}</strong>
            </p>
          </div>

          <div className="px-6 py-6">
            <p className="text-sm leading-6 text-[#68574f]">
              Đội ngũ Tâm An Center sẽ điều phối <strong className="text-[#281b18]">{requiredTherapists} KTV</strong> và gọi số{" "}
              <strong className="text-[#281b18]">{contactPhone}</strong> trước giờ hẹn 2 tiếng để xác nhận lần cuối trước khi triển khai
              dịch vụ tận nơi cho {companyName}.
            </p>
            <Link href={`/doanh-nghiep/${persistedEventCode || inquiryCode}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#76551d] px-4 py-3 text-sm font-semibold text-white">
              Xem hồ sơ vận hành & Bill Business <ChevronRight size={16} />
            </Link>

            <div className="mt-5 space-y-2.5 border-t border-dashed border-[#e7d6ca] pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#826f66]">Các bước tiếp theo</p>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff4e6] text-xs font-bold text-[#76551d]">
                  1
                </span>
                <p className="mt-0.5 text-xs leading-5 text-[#51423b]">
                  Đội ngũ Tâm An Center xác nhận đầu người thực tế trước giờ hẹn 2 tiếng.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff4e6] text-xs font-bold text-[#76551d]">
                  2
                </span>
                <p className="mt-0.5 text-xs leading-5 text-[#51423b]">
                  {requiredTherapists} KTV di chuyển đến {officeAddress || "văn phòng của bạn"}.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff4e6] text-xs font-bold text-[#76551d]">
                  3
                </span>
                <p className="mt-0.5 text-xs leading-5 text-[#51423b]">
                  Triển khai dịch vụ tận nơi đúng khung giờ {timeWindow}, ngày {date}.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2 rounded-2xl bg-[#fbf2e7] p-4 text-sm text-[#51423b]">
              <p className="flex items-center gap-2 font-semibold text-[#5c3a1e]">
                <Briefcase size={14} /> Tóm tắt yêu cầu
              </p>
              <p className="flex items-center gap-2 text-xs">
                <Users size={13} className="shrink-0 text-[#8a5a12]" /> {headcount} người · {trial.durationMin} phút/người
              </p>
              <p className="flex items-center gap-2 text-xs">
                <CalendarClock size={13} className="shrink-0 text-[#8a5a12]" /> {timeWindow}, ngày {date}
              </p>
              <p className="flex items-center gap-2 text-xs">
                <MapPin size={13} className="shrink-0 text-[#8a5a12]" /> {officeAddress}
              </p>
              {wantsCorporatePackage ? (
                <p className="flex items-center gap-2 text-xs">
                  <Sparkles size={13} className="shrink-0 text-[#8a5a12]" /> Đăng ký {tier.name} — {tier.sessionsPerMonth} buổi/tháng
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t border-dashed border-[#e8d3ab] pt-2">
                <span className="text-xs text-[#826f66]">Đã đặt cọc</span>
                <span className="text-base font-bold text-[#c64b32]">{formatMoney(depositAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#826f66]">
                <span>Còn lại tại cơ sở · đã trừ ưu đãi</span>
                <span className="font-semibold text-[#51423b]">{formatMoney(amountDueOnsite)}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/thong-bao"
                className="flex-1 rounded-full border border-[#c64b32] px-4 py-2.5 text-center text-sm font-semibold text-[#c64b32]"
              >
                Xem thông báo
              </Link>
              <Link href="/" className="flex-1 rounded-full bg-[#c64b32] px-4 py-2.5 text-center text-sm font-semibold text-white">
                Về trang chủ
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "deposit") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecd2b4_0,#fdf8f3_42%,#f7ede5_100%)] px-4 py-8 text-[#281b18] sm:px-6">
        <section className="mx-auto max-w-xl space-y-4">
          <div className="rounded-2xl border border-[#e7d6ca] bg-white p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#c64b32]">
              <Sparkles size={13} /> Báo giá tự động
            </p>
            <h1 className="mt-1.5 text-lg font-semibold tracking-tight">Yêu cầu {inquiryCode}</h1>
            <p className="mt-1.5 text-sm leading-6 text-[#68574f]">
              Tâm An Center đã tự động lên báo giá cho {companyName}. Bạn chỉ cần đặt cọc {depositPolicy.percent}% giá trị ban đầu để giữ lịch, đội ngũ
              chúng tôi sẽ xác nhận & triển khai dịch vụ tận nơi.
            </p>

            <div className="mt-3.5 space-y-1.5 border-t border-dashed border-[#e7d6ca] pt-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#68574f]">
                  {headcount} người × {formatMoney(trial.pricePerPerson)}
                </span>
                <span className="font-semibold">{formatMoney(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex items-center justify-between text-[#76551d]">
                  <span>
                    Ưu đãi {tier.name} (-{tier.discountPercent}%)
                  </span>
                  <span className="font-semibold">-{formatMoney(discount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-[#68574f]">
                <span className="flex items-center gap-1">
                  <Truck size={13} /> Di chuyển ({requiredTherapists} KTV × {formatMoney(corporateTransportFee.feePerTherapist)})
                </span>
                <span className="font-semibold">{transportFee > 0 ? formatMoney(transportFee) : "Miễn phí"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[#e7d6ca] pt-1.5 text-base font-semibold">
                <span>Tổng ước tính</span>
                <span className="text-[#c64b32]">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-[#c64b32] bg-[#f8ebe5] p-3.5">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#c64b32]" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Cọc nền tảng để giữ lịch</span>
                <span className="mt-0.5 block text-base font-bold text-[#c64b32]">
                  {formatMoney(depositAmount)} <span className="text-xs font-normal text-[#826f66]">({depositPolicy.percent}% giá trị ban đầu)</span>
                </span>
                <span className="mt-1 block text-xs text-[#826f66]">
                  Còn lại {formatMoney(amountDueOnsite)} = 90% giá trị ban đầu trừ ưu đãi, thanh toán riêng sau dịch vụ.
                </span>
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#d2ad5d] bg-gradient-to-br from-[#2a1916] via-[#4b2619] to-[#7d211f] p-5 text-white shadow-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#e7c878]"><Wallet size={16} /> Giữ lịch bằng khoản cọc {formatMoney(depositAmount)}</p>
            <p className="mt-2 text-xs leading-5 text-white/70">Bước tiếp theo mới hiển thị ngân hàng và mã VietQR đúng số tiền. Bạn vẫn có thể quay lại kiểm tra báo giá trước khi chuyển.</p>
            <button type="button" onClick={() => void prepareDeposit()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e7c878] px-4 py-3 text-sm font-semibold text-[#3d1f12] shadow-lg">
              Chuyển khoản đặt cọc dịch vụ <ChevronRight size={16} />
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "payment") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f0d9bd_0,#fdf8f3_42%,#f7ede5_100%)] px-4 py-7 text-[#281b18] sm:px-6">
        <section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#d2ad5d]/70 bg-white shadow-2xl shadow-[#5c3a1e]/15">
          <div className="bg-gradient-to-br from-[#211514] via-[#4b2619] to-[#8b2b28] px-5 py-6 text-white">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e7c878]"><ShieldCheck size={13} /> Thanh toán bảo mật · {inquiryCode}</p>
            <h1 className="mt-2 text-xl font-semibold">Chọn ngân hàng chuyển khoản</h1>
            <p className="mt-1 text-xs leading-5 text-white/70">Số tiền cọc chuyển vào tài khoản nền tảng đã được khóa bằng 10% giá trị ban đầu: <strong className="text-white">{formatMoney(depositAmount)}</strong>.</p>
          </div>
          <div className="p-5">
            <div className="mb-4 grid grid-cols-3 rounded-2xl bg-[#fbf2e7] p-3 text-center"><span className="text-[9px] text-[#826f66]">Sau ưu đãi<strong className="mt-1 block text-xs text-[#281b18]">{formatMoney(total)}</strong></span><span className="border-x border-[#e7d6ca] text-[9px] text-[#826f66]">Cọc nền tảng<strong className="mt-1 block text-xs text-[#c64b32]">{formatMoney(depositAmount)}</strong></span><span className="text-[9px] text-[#826f66]">Còn lại<strong className="mt-1 block text-xs text-[#281b18]">{formatMoney(amountDueOnsite)}</strong></span></div>
            <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><Wallet size={16} className="text-[#c64b32]" /> VietQR đặt cọc Tâm An Business</p>
            {pendingPayment?.paymentCode ? <BankTransferDetails amount={depositAmount} transferContent={pendingPayment.paymentCode} onConfirm={confirmDeposit} helperText="Đây là tài khoản nhận cọc của nền tảng. SePay tự động đối soát đúng 10% giá trị ban đầu và đưa giao dịch vào sổ liên quan." /> : <div className="rounded-2xl bg-[#f7f3ef] p-5 text-center"><Loader2 className="mx-auto animate-spin text-[#c64b32]" size={24} /><p className="mt-2 text-sm font-semibold">Đang tạo VietQR đặt cọc…</p></div>}
            {submitError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{submitError}</p> : null}
            <button type="button" onClick={() => setStage("deposit")} className="mt-3 w-full py-2 text-xs font-semibold text-[#826f66]">Quay lại xem báo giá</button>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "confirming") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecd2b4_0,#fdf8f3_42%,#f7ede5_100%)] px-4 py-8 text-[#281b18] sm:px-6">
        <section className="mx-auto flex max-w-xl flex-col items-center gap-2.5 rounded-2xl border border-[#c59a3d] bg-[#fbf2e7] p-10 text-center">
          <Loader2 className="animate-spin text-[#c64b32]" size={28} />
          <p className="text-sm font-semibold text-[#5c3a1e]">Đang chờ ngân hàng đối soát qua SePay...</p>
          <p className="text-xs text-[#826f66]">Yêu cầu chỉ chuyển sang thành công sau khi webhook xác nhận giao dịch.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecd2b4_0,#fdf8f3_36%,#f7ede5_100%)] px-4 py-6 text-[#281b18] sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-[#d2ad5d]/70 bg-gradient-to-br from-[#211514] via-[#4d271a] to-[#8f1f21] p-5 text-white shadow-2xl shadow-[#5c3a1e]/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#c59a3d]/20 blur-2xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c878]/25 bg-white/10 px-3 py-1 text-xs font-semibold text-[#e7c878]">
            <Briefcase size={13} /> Tâm An Business cho doanh nghiệp
          </span>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Đặt lịch massage tận nơi cho công ty</h1>
          <p className="mt-1.5 text-sm leading-6 text-white/72">
            KTV đến tận văn phòng vào giờ nghỉ trưa, phục vụ nhiều nhân sự theo slot 15-30 phút/người.
          </p>
          <div className="relative mt-4 flex items-start gap-2.5 rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7c878] text-[#3d1f12] shadow-sm">
              <Sparkles size={16} />
            </span>
            <p className="text-xs leading-5 text-white/75">
              <strong className="font-semibold">Tâm An Center sẽ tự động lên báo giá</strong> — bạn chỉ cần đặt cọc{" "}
              {depositPolicy.percent}% giá trị ban đầu trước ưu đãi để xác nhận, đội ngũ chúng tôi sẽ xác nhận & triển khai dịch vụ tận nơi.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d2ad5d]/55 bg-gradient-to-br from-white to-[#fff9f1] p-4 shadow-md shadow-[#5c3a1e]/5">
          <h2 className="mb-2.5 flex items-center gap-2 text-base font-semibold tracking-tight">
            <Briefcase size={18} /> 1. Thông tin công ty
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold">Tên công ty</span>
              <textarea
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Ví dụ: Công ty TNHH ABC"
                rows={2}
                className="mt-1.5 min-h-[68px] w-full resize-none rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm leading-5"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Mã số thuế</span>
              <input
                value={taxCode}
                onChange={(event) => setTaxCode(event.target.value)}
                placeholder="Ví dụ: 0110786403"
                className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold">Địa chỉ văn phòng / công ty</span>
              <textarea
                value={officeAddress}
                onChange={(event) => setOfficeAddress(event.target.value)}
                placeholder="Số nhà, tên toà nhà, phường/xã, quận/huyện"
                rows={2}
                className="mt-1.5 min-h-[68px] w-full resize-none rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm leading-5"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Người liên hệ (HR / CEO...)</span>
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Họ tên người phụ trách"
                className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Số điện thoại liên hệ</span>
              <input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="09xx xxx xxx"
                className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-[#826f66]">
            <MapPin size={12} className="mt-0.5 shrink-0" /> Cơ sở phục vụ gần nhất:{" "}
            {branches.map((item) => item.label).join(" · ")} — {corporateTransportFee.note}
          </p>
        </div>

        <div className="rounded-2xl border border-[#d2ad5d]/55 bg-gradient-to-br from-white to-[#fff9f1] p-4 shadow-md shadow-[#5c3a1e]/5">
          <h2 className="mb-2.5 flex items-center gap-2 text-base font-semibold tracking-tight">
            <CalendarClock size={18} /> 2. Chọn khung giờ & số lượng nhân sự
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-xs font-semibold">Ngày phục vụ</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
              />
            </label>
            <div>
              <p className="text-xs font-semibold">Khung giờ nghỉ trưa</p>
              <CompactSelect className="mt-1.5" value={timeWindow} onValueChange={setTimeWindow} dialogTitle="Chọn khung giờ phục vụ" triggerClassName="rounded-lg text-sm font-normal" options={TIME_WINDOWS.map((window) => ({ value: window, label: window }))} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#e7d6ca] bg-[#fdf8f5] px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Users size={15} className="text-[#c64b32]" /> Số lượng nhân sự
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHeadcount((value) => Math.max(1, value - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e7d6ca] bg-white"
                aria-label="Giảm số người"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm font-semibold">{headcount}</span>
              <button
                type="button"
                onClick={() => setHeadcount((value) => Math.min(200, value + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e7d6ca] bg-white"
                aria-label="Tăng số người"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#826f66]">
            Khuyến nghị tối thiểu 5 người/buổi. Hệ thống dự kiến điều phối <strong>{requiredTherapists} KTV</strong> cho đơn này.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d2ad5d]/55 bg-gradient-to-br from-white to-[#fff9f1] p-4 shadow-md shadow-[#5c3a1e]/5">
          <h2 className="mb-2.5 flex items-center gap-2 text-base font-semibold tracking-tight">
            <Clock size={18} /> 3. Chọn thời lượng trải nghiệm
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {corporateTrialPackages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTrialId(item.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  trialId === item.id ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                )}
              >
                <span className="flex items-center gap-1 text-xs font-semibold text-[#c64b32]">
                  <Clock size={12} /> {item.durationMin} phút/người
                </span>
                <span className="mt-1.5 block text-sm font-semibold">{formatMoney(item.pricePerPerson)}</span>
                <span className="mt-1 block text-[11px] leading-4 text-[#826f66]">{item.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#826f66]">Giá gói dùng thử lần đầu, chưa bao gồm phí di chuyển.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#d2ad5d]/55 bg-gradient-to-br from-white to-[#fff9f1] p-4 shadow-md shadow-[#5c3a1e]/5">
          <div className="grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Sparkles size={18} className="shrink-0" /> 4. Gói Doanh nghiệp
              </h2>
              <p className="mt-0.5 text-xs text-[#826f66]">Sức khỏe định kỳ cho cả công ty (tuỳ chọn)</p>
            </div>
            <button
              type="button"
              onClick={() => setWantsCorporatePackage((value) => !value)}
              className={cn(
                "mt-0.5 flex h-6 w-11 shrink-0 select-none items-center overflow-hidden rounded-full p-0.5 transition-colors",
                wantsCorporatePackage ? "justify-end" : "justify-start",
                wantsCorporatePackage ? "bg-[#c64b32]" : "bg-[#e7d6ca]"
              )}
              style={{ width: 44, minWidth: 44, maxWidth: 44 }}
              role="switch"
              aria-checked={wantsCorporatePackage}
              aria-label="Đăng ký gói Doanh nghiệp"
            >
              <span className="block h-5 w-5 shrink-0 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-[#826f66]">
            Đăng ký định kỳ để KTV ghé công ty theo lịch cố định hàng tuần — chủ động chăm sóc sức khỏe toàn đội ngũ, đồng thời được giảm
            giá và miễn phí di chuyển.
          </p>

          {wantsCorporatePackage ? (
            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
              {corporatePackageTiers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTierId(item.id)}
                  className={cn(
                    "relative rounded-xl border p-3.5 text-left transition",
                    tierId === item.id ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                  )}
                >
                  {item.highlight ? (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-[#c64b32] px-2 py-0.5 text-[10px] font-semibold text-white">
                      Phổ biến nhất
                    </span>
                  ) : null}
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#c64b32]">
                    <Percent size={12} /> Giảm {item.discountPercent}%
                    {item.bonusSessions > 0 ? ` · tặng ${item.bonusSessions} buổi` : ""}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-[#826f66]">
                    {item.sessionsPerMonth} buổi/tháng · {item.minHeadcountPerSession}-{item.maxHeadcountPerSession} người/buổi
                  </span>
                  <ul className="mt-2 space-y-1 text-[11px] leading-4 text-[#51423b]">
                    {item.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-1">
                        <Check size={11} className="mt-0.5 shrink-0 text-[#76551d]" /> {perk}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          ) : null}

          {headcountTooLow ? (
            <p className="mt-2.5 text-[11px] font-semibold text-[#c64b32]">
              {tier.name} cần tối thiểu {tier.minHeadcountPerSession} người/buổi — hãy tăng số lượng nhân sự ở bước 2.
            </p>
          ) : null}
          {headcountTooHigh ? (
            <p className="mt-2.5 text-[11px] font-semibold text-[#c64b32]">
              {tier.name} phục vụ tối đa {tier.maxHeadcountPerSession} người/buổi — hãy giảm số lượng hoặc chọn gói cao hơn.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#f0d9b5] bg-[#fdf8f5] p-4 shadow-sm">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#c64b32]">
            <Gift size={15} /> Ước tính chi phí
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#68574f]">
                {headcount} người × {formatMoney(trial.pricePerPerson)}
              </span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-[#76551d]">
                <span>
                  Ưu đãi {tier.name} (-{tier.discountPercent}%)
                </span>
                <span className="font-semibold">-{formatMoney(discount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-[#68574f]">
              <span className="flex items-center gap-1">
                <Truck size={13} /> Di chuyển ({requiredTherapists} KTV × {formatMoney(corporateTransportFee.feePerTherapist)})
              </span>
              <span className="font-semibold">{transportFee > 0 ? formatMoney(transportFee) : "Miễn phí"}</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-[#e7d6ca] pt-2.5">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#68574f]">Tổng ước tính</span>
            <span className="text-xl font-semibold text-[#c64b32]">{formatMoney(total)}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-[#826f66]">
            Báo giá tự động theo thông tin bạn nhập. Đặt cọc {depositPolicy.percent}% giá trị ban đầu trước ưu đãi để giữ lịch, đội ngũ Tâm An Center sẽ xác nhận đầu
            người thực tế trước khi triển khai.
          </p>

          <button
            type="button"
            onClick={goToQuote}
            disabled={!canSubmit}
            className="mt-4 w-full rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xem báo giá & đặt cọc giữ lịch
          </button>
        </div>
      </div>
    </main>
  );
}
