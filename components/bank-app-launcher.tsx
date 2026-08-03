"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Landmark, Loader2, Search, Smartphone, X } from "lucide-react";
import type { VietQrBankApp } from "@/lib/vietqr";

const FALLBACK_BANK_APPS: VietQrBankApp[] = [
  { appId: "vcb", appLogo: "", appName: "Vietcombank", bankName: "Vietcombank", deeplink: "https://dl.vietqr.io/pay?app=vcb" },
  { appId: "mb", appLogo: "", appName: "MB Bank", bankName: "MB Bank", deeplink: "https://dl.vietqr.io/pay?app=mb" },
  { appId: "tcb", appLogo: "", appName: "Techcombank Mobile", bankName: "Techcombank", deeplink: "https://dl.vietqr.io/pay?app=tcb" },
  { appId: "bidv", appLogo: "", appName: "BIDV SmartBanking", bankName: "BIDV", deeplink: "https://dl.vietqr.io/pay?app=bidv" },
  { appId: "icb", appLogo: "", appName: "VietinBank iPay", bankName: "VietinBank", deeplink: "https://dl.vietqr.io/pay?app=icb" },
  { appId: "acb", appLogo: "", appName: "ACB One", bankName: "ACB", deeplink: "https://dl.vietqr.io/pay?app=acb" },
  { appId: "vpb", appLogo: "", appName: "VPBank NEO", bankName: "VPBank", deeplink: "https://dl.vietqr.io/pay?app=vpb" },
  { appId: "tpb", appLogo: "", appName: "TPBank Mobile", bankName: "TPBank", deeplink: "https://dl.vietqr.io/pay?app=tpb" },
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

export function BankAppLauncher({ onOpened }: { onOpened?: (bankName: string) => void }) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState(FALLBACK_BANK_APPS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const apple = isAppleDevice();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/public/bank-apps?platform=${apple ? "ios" : "android"}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("bank apps unavailable")))
      .then((payload: { apps?: VietQrBankApp[] }) => {
        if (Array.isArray(payload.apps) && payload.apps.length) setApps(payload.apps);
      })
      .catch(() => setApps(FALLBACK_BANK_APPS))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [apple, open]);

  const visibleApps = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return apps;
    return apps.filter((app) => `${app.appName} ${app.bankName}`.toLocaleLowerCase("vi").includes(keyword));
  }, [apps, search]);

  function launch(app: VietQrBankApp) {
    onOpened?.(app.bankName);
    setOpen(false);
    window.location.assign(app.deeplink);
  }

  function openPicker() {
    setLoading(true);
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openPicker} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#c22630] to-[#8f151a] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-black/15">
        <Smartphone size={17} /> Mở App ngân hàng để thanh toán
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]" role="presentation" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Chọn ứng dụng ngân hàng" onClick={(event) => event.stopPropagation()} className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-[#fffaf6] shadow-2xl">
            <div className="border-b border-[#eadbd1] bg-white px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-sm font-bold"><Landmark size={16} className="text-[#9f1d20]" /> Chọn ứng dụng ngân hàng</p><p className="mt-1 text-[10px] leading-4 text-[#8a7a72]">App chỉ được mở để bạn chủ động thanh toán tại quầy. Tâm An không hiển thị QR hoặc số tài khoản trên màn hình này.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5efeb]"><X size={16} /></button></div>
              <label className="mt-3 flex items-center gap-2 rounded-full border border-[#e4d5cc] bg-[#fffaf6] px-3 py-2.5"><Search size={15} className="text-[#9f1d20]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ngân hàng..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {loading ? <p className="flex items-center justify-center gap-2 py-2 text-xs text-[#8a7a72]"><Loader2 size={14} className="animate-spin" /> Đang tải ngân hàng trên thiết bị...</p> : null}
              <div className="space-y-2">{visibleApps.map((app) => <div key={app.appId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-[#eadbd1] bg-white p-2 shadow-sm"><button type="button" onClick={() => launch(app)} className="flex min-w-0 items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f7f2ee] text-[10px] font-bold text-[#9f1d20]">{app.appLogo ? <img src={app.appLogo} alt="" className="h-full w-full object-cover" /> : app.appId.toUpperCase().slice(0, 3)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{app.appName.replace(/^‎/, "")}</span><span className="mt-0.5 block truncate text-[9px] text-[#8a7a72]">{app.bankName}</span></span><ChevronRight size={15} className="text-[#9f1d20]" /></button><a href={appStoreSearch(app.appName, apple)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#f5efeb] px-2.5 py-2 text-[9px] font-semibold text-[#665b55]">Chưa cài? <ExternalLink size={10} /></a></div>)}</div>
              {!visibleApps.length ? <p className="rounded-2xl border border-dashed border-[#d9c9c0] bg-white p-5 text-center text-xs text-[#8a7a72]">Không tìm thấy ngân hàng phù hợp.</p> : null}
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#eef8f2] p-3 text-[10px] leading-4 text-[#3e6652]"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /> Sau khi thanh toán tại quầy, Lễ tân hoặc Quản lý cơ sở bấm “Đã thanh toán”; Bill của bạn sẽ tự cập nhật.</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
