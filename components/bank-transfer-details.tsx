"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Landmark,
  Loader2,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  TimerReset,
  X,
} from "lucide-react";
import { getPublicPaymentConfig, type PaymentPurpose } from "@/lib/public-payment-config";
import {
  buildVietQrBankAppUrl,
  buildVietQrImageUrl,
  type VietQrBankApp,
} from "@/lib/vietqr";
import { formatMoney } from "@/lib/utils";

const PAYMENT_WINDOW_SECONDS = 15 * 60;

const FALLBACK_BANK_APPS: VietQrBankApp[] = [
  { appId: "vcb", appLogo: "", appName: "Vietcombank", bankName: "Vietcombank", deeplink: "https://dl.vietqr.io/pay?app=vcb" },
  { appId: "mb", appLogo: "", appName: "MB Bank", bankName: "MB Bank", deeplink: "https://dl.vietqr.io/pay?app=mb" },
  { appId: "tcb", appLogo: "", appName: "Techcombank Mobile", bankName: "Techcombank", deeplink: "https://dl.vietqr.io/pay?app=tcb" },
  { appId: "bidv", appLogo: "", appName: "BIDV SmartBanking", bankName: "BIDV", deeplink: "https://dl.vietqr.io/pay?app=bidv", autofill: 1 },
  { appId: "icb", appLogo: "", appName: "VietinBank iPay", bankName: "VietinBank", deeplink: "https://dl.vietqr.io/pay?app=icb", autofill: 1 },
  { appId: "acb", appLogo: "", appName: "ACB One", bankName: "ACB", deeplink: "https://dl.vietqr.io/pay?app=acb", autofill: 1 },
  { appId: "vpb", appLogo: "", appName: "VPBank NEO", bankName: "VPBank", deeplink: "https://dl.vietqr.io/pay?app=vpb" },
  { appId: "tpb", appLogo: "", appName: "TPBank Mobile", bankName: "TPBank", deeplink: "https://dl.vietqr.io/pay?app=tpb" },
  { appId: "ocb", appLogo: "", appName: "OCB OMNI", bankName: "OCB", deeplink: "https://dl.vietqr.io/pay?app=ocb", autofill: 1 },
];

function isAppleDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function appStoreSearch(appName: string, apple: boolean) {
  const term = encodeURIComponent(appName.replace(/^‎/, ""));
  return apple
    ? `https://apps.apple.com/vn/search?term=${term}`
    : `https://play.google.com/store/search?q=${term}&c=apps`;
}

export function BankTransferDetails({
  amount,
  transferContent,
  onConfirm,
  purpose = "general",
  helperText = "Hệ thống tự động đối soát đúng số tiền và nội dung chuyển khoản.",
}: {
  amount: number;
  transferContent: string;
  purpose?: PaymentPurpose;
  sourceBankName?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  helperText?: string;
}) {
  const bankAccount = getPublicPaymentConfig(purpose);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SECONDS);
  const [showBankApps, setShowBankApps] = useState(false);
  const [bankApps, setBankApps] = useState<VietQrBankApp[]>(FALLBACK_BANK_APPS);
  const [loadingApps, setLoadingApps] = useState(false);
  const [search, setSearch] = useState("");
  const [savingQr, setSavingQr] = useState(false);
  const [savedQr, setSavedQr] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showBankApps) return;
    const controller = new AbortController();
    const platform = isAppleDevice() ? "ios" : "android";
    fetch(`/api/public/bank-apps?platform=${platform}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Không tải được danh sách ngân hàng.")))
      .then((payload: { apps?: VietQrBankApp[] }) => {
        if (Array.isArray(payload.apps) && payload.apps.length > 0) setBankApps(payload.apps);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBankApps(FALLBACK_BANK_APPS);
      })
      .finally(() => setLoadingApps(false));
    return () => controller.abort();
  }, [showBankApps]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const qrUrl = buildVietQrImageUrl(amount, transferContent, purpose);
  const qrDownloadUrl = `/api/public/vietqr?${new URLSearchParams({
    amount: String(Math.round(amount)),
    content: transferContent,
    purpose,
  }).toString()}`;
  const apple = isAppleDevice();
  const visibleApps = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return bankApps;
    return bankApps.filter((app) => `${app.appName} ${app.bankName}`.toLocaleLowerCase("vi").includes(keyword));
  }, [bankApps, search]);

  async function saveQr() {
    setSavingQr(true);
    setSavedQr(false);
    setSaveNotice("");
    try {
      const response = await fetch(qrDownloadUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Không tải được mã QR.");
      const blob = await response.blob();
      const fileName = `TamAnCare-${transferContent}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "VietQR Tâm An Center" });
        setSaveNotice("Đã mở bảng lưu/chia sẻ. Trên iPhone, chọn “Lưu hình ảnh”.");
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        setSaveNotice("Mã QR đã được tải xuống thiết bị.");
      }
      setSavedQr(true);
      window.setTimeout(() => setSavedQr(false), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setSaveNotice("Bạn đã đóng bảng lưu ảnh. Có thể bấm lại khi cần.");
      } else {
        setSaveNotice("Thiết bị chưa cho phép tải trực tiếp. Hãy nhấn giữ mã QR phía trên và chọn “Lưu vào Ảnh”.");
      }
      setSavedQr(false);
    } finally {
      setSavingQr(false);
    }
  }

  function openBankApp(app: VietQrBankApp) {
    onConfirm?.();
    setShowBankApps(false);
    window.location.assign(buildVietQrBankAppUrl({
      app,
      amount,
      transferContent,
      returnUrl: window.location.href,
      purpose,
    }));
  }

  function openBankPicker() {
    setLoadingApps(true);
    setShowBankApps(true);
  }

  if (!bankAccount.configured) {
    return <p className="text-xs leading-5 text-[#51423b]">Tâm An Center đang cập nhật thông tin nhận chuyển khoản. Vui lòng liên hệ lễ tân.</p>;
  }

  return (
    <div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7d4ca] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#e7d6ca] bg-[#fdf8f3] px-3 py-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-[#76551d]"><ShieldCheck size={12} /> VietQR đã điền sẵn</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-[#8a5a12]"><TimerReset size={12} /> {minutes}:{String(seconds).padStart(2, "0")}</span>
        </div>

        <div className="p-4 text-center">
          <div className="mx-auto w-fit rounded-2xl border border-[#e7d6ca] bg-white p-2.5 shadow-md shadow-[#5c3a1e]/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`VietQR chuyển ${formatMoney(amount)}`} className="h-44 w-44 object-contain sm:h-48 sm:w-48" />
          </div>
          <p className="mt-3 text-xl font-bold text-[#c64b32]">{formatMoney(amount)}</p>
          <p className="mt-0.5 font-mono text-[11px] font-semibold tracking-wide text-[#51423b]">{transferContent}</p>

          <div className="mx-auto mt-3 max-w-md rounded-xl bg-[#fff8f2] px-3 py-2.5 text-left text-[11px] leading-5 text-[#68574f]">
            <p className="flex items-center justify-between gap-3"><span>Ngân hàng nhận</span><strong>{bankAccount.bankName}</strong></p>
            <p className="flex items-center justify-between gap-3"><span>Số tài khoản</span><strong className="font-mono text-[#c64b32]">{bankAccount.accountNumber}</strong></p>
            <p className="flex items-start justify-between gap-3"><span className="shrink-0">Chủ tài khoản</span><strong className="max-w-[68%] text-right text-[10px]">{bankAccount.accountHolder}</strong></p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void saveQr()} disabled={savingQr} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#c64b32] px-3 text-xs font-semibold text-[#c64b32] disabled:opacity-55">
              {savingQr ? <Loader2 className="animate-spin" size={15} /> : savedQr ? <Check size={15} /> : <Download size={15} />}
              {savedQr ? "Đã lưu mã" : "Lưu mã QR"}
            </button>
            <button type="button" onClick={openBankPicker} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#b6403a] to-[#8b2b28] px-3 text-xs font-semibold text-white shadow-md shadow-black/15">
              <Smartphone size={15} /> Mở app ngân hàng
            </button>
          </div>
          {saveNotice ? <p role="status" className="mt-2 rounded-xl bg-[#fbf2e7] px-3 py-2 text-[10px] leading-4 text-[#76551d]">{saveNotice}</p> : null}
        </div>
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-5 text-[#826f66]">
        <QrCode size={13} className="mt-0.5 shrink-0 text-[#c64b32]" />
        {helperText} Giữ nguyên số tiền và nội dung để SePay xác nhận tự động.
      </p>

      {showBankApps ? (
        <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]" role="presentation" onClick={() => setShowBankApps(false)}>
          <section role="dialog" aria-modal="true" aria-label="Chọn ứng dụng ngân hàng" onClick={(event) => event.stopPropagation()} className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-[#fdf8f3] shadow-2xl">
            <div className="border-b border-[#e7d6ca] bg-white px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="flex items-center gap-1.5 text-sm font-bold text-[#281b18]"><Landmark size={16} className="text-[#c64b32]" /> Chọn ứng dụng ngân hàng</p><p className="mt-1 text-[10px] leading-4 text-[#826f66]">Ứng dụng hỗ trợ sẽ mở màn hình chuyển khoản; thông tin VietQR đã được đính kèm.</p></div>
                <button type="button" onClick={() => setShowBankApps(false)} aria-label="Đóng danh sách ngân hàng" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5efeb] text-[#68574f]"><X size={16} /></button>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-full border border-[#e4d5cc] bg-[#fdf8f3] px-3 py-2.5">
                <Search size={15} className="text-[#c64b32]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ngân hàng..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {loadingApps ? <p className="mb-2 flex items-center justify-center gap-2 py-2 text-xs text-[#826f66]"><Loader2 size={14} className="animate-spin" /> Đang cập nhật danh sách ngân hàng Việt Nam...</p> : null}
              <div className="space-y-2">
                {visibleApps.map((app) => (
                  <div key={app.appId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-[#e7d6ca] bg-white p-2 shadow-sm">
                    <button type="button" onClick={() => openBankApp(app)} className="flex min-w-0 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f7f2ee] text-[10px] font-bold text-[#c64b32]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {app.appLogo ? <img src={app.appLogo} alt="" className="h-full w-full object-cover" /> : app.appId.toUpperCase().slice(0, 3)}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#281b18]">{app.appName.replace(/^‎/, "")}</span><span className="mt-0.5 block truncate text-[9px] text-[#826f66]">{app.autofill ? "Hỗ trợ điền sẵn thông tin" : app.bankName}</span></span>
                      <ChevronRight size={15} className="shrink-0 text-[#c64b32]" />
                    </button>
                    <a href={appStoreSearch(app.appName, apple)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#f5efeb] px-2.5 py-2 text-[9px] font-semibold text-[#68574f]">Chưa cài? <ExternalLink size={10} /></a>
                  </div>
                ))}
              </div>
              {!visibleApps.length ? <p className="rounded-2xl border border-dashed border-[#d9c9c0] bg-white p-5 text-center text-xs text-[#826f66]">Không tìm thấy ngân hàng phù hợp. Bạn vẫn có thể lưu QR và quét trong bất kỳ ứng dụng ngân hàng nào.</p> : null}
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#fbf2e7] p-3 text-[10px] leading-4 text-[#a85f29]"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /> Nếu chưa cài ứng dụng, dùng liên kết “Chưa cài?” để mở chợ ứng dụng. Bạn luôn có thể quay lại và thanh toán bằng QR đã lưu.</p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
