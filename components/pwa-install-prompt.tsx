"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  MoreVertical,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { activateInstalledReferralAttribution } from "@/lib/referral-attribution";

type InstallPlatform = "ios" | "android" | "other";
type InstallGuide = "ios" | "android" | null;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function currentPlatform(): InstallPlatform {
  const userAgent = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/i.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function subscribeToClientReady() {
  return () => undefined;
}

export function PwaInstallPrompt() {
  const [guide, setGuide] = useState<InstallGuide>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installedByEvent, setInstalledByEvent] = useState(false);
  const [activationState, setActivationState] = useState<"idle" | "active" | "unavailable">("idle");
  const [copied, setCopied] = useState(false);
  const clientReady = useSyncExternalStore(subscribeToClientReady, () => true, () => false);
  const userAgent = clientReady ? navigator.userAgent : "";
  const platform = clientReady ? currentPlatform() : "other";
  const installed = installedByEvent || (clientReady && isStandalone());
  const inAppBrowser = /FBAN|FBAV|Instagram|Messenger|Zalo|Line\//i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalledByEvent(true);
      setInstallPrompt(null);
      setGuide(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!installed || activationState !== "idle") return;
    let active = true;
    void activateInstalledReferralAttribution()
      .then((code) => {
        if (active) setActivationState(code ? "active" : "unavailable");
      })
      .catch(() => {
        if (active) setActivationState("unavailable");
      });
    return () => { active = false; };
  }, [activationState, installed]);

  async function installOnAndroid() {
    if (!installPrompt) {
      setGuide("android");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function copyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (installed) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        <CheckCircle2 size={17} className="shrink-0" />
        {activationState === "active"
          ? "Tâm An Center đã ở trên màn hình chính; nguồn giới thiệu và quà 50K đã được kích hoạt."
          : activationState === "idle"
            ? "Đang đồng bộ nguồn giới thiệu và quà 50K với thiết bị này..."
            : "App đã được cài. Hãy mở Tâm An Center từ biểu tượng màn hình chính để hoàn tất quyền lợi 50K."}
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-gradient-to-br from-white to-[#fff6ef] shadow-sm">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#211716] shadow-md ring-1 ring-[#d8b86a]">
            <Image src="/icon-192.png" alt="Biểu tượng Tâm An Center" width={48} height={48} className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Webapp trên điện thoại</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Cài Tâm An Center để mở lại trong một chạm</h2>
            <p className="mt-1 text-xs leading-5 text-[#6f625c]">Không cần App Store hay CH Play. Sau khi cài và mở từ biểu tượng app, nguồn giới thiệu cùng voucher 50K sẽ được khóa trên hệ thống.</p>
          </div>
        </div>

        {inAppBrowser ? (
          <div className="mx-4 mb-3 rounded-xl bg-[#fff2d9] px-3 py-2 text-[11px] leading-5 text-[#79520d] ring-1 ring-[#efd293]">
            Bạn đang mở link trong Facebook/Zalo. Hãy chọn <strong>Mở bằng Safari</strong> trên iPhone hoặc <strong>Mở bằng Chrome</strong> trên Android rồi cài.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 border-t border-[#eee1d8] p-3">
          <button
            type="button"
            onClick={() => setGuide("ios")}
            className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${platform === "ios" ? "border-[#c64b32] bg-[#f8ebe5] text-[#8b1b1e]" : "border-[#e7d6ca] bg-white text-[#433a36]"}`}
          >
            <span><span className="block text-xs font-semibold">Cài trên iPhone</span><span className="mt-0.5 block text-[10px] opacity-70">Qua Safari</span></span>
            <ChevronRight size={15} className="shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => void installOnAndroid()}
            className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${platform === "android" ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] bg-white text-[#433a36]"}`}
          >
            <span><span className="block text-xs font-semibold">Cài trên Android</span><span className="mt-0.5 block text-[10px] opacity-70">{installPrompt ? "Cài ngay" : "Qua Chrome"}</span></span>
            <Download size={15} className="shrink-0" />
          </button>
        </div>
      </section>

      {guide ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-[2px] sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGuide(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="install-guide-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 bg-gradient-to-br from-[#2b1815] via-[#69251d] to-[#a11f24] px-5 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12"><Smartphone size={20} /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f6d983]">Chỉ mất khoảng 10 giây</p>
                  <h2 id="install-guide-title" className="mt-0.5 text-lg font-semibold">Cài trên {guide === "ios" ? "iPhone" : "Android"}</h2>
                </div>
              </div>
              <button type="button" onClick={() => setGuide(null)} aria-label="Đóng hướng dẫn cài đặt" className="rounded-full bg-white/10 p-2"><X size={17} /></button>
            </header>

            <div className="space-y-3 p-5 text-sm text-[#51423b]">
              {guide === "ios" ? (
                <>
                  {!isSafari ? <p className="rounded-xl bg-[#fff2d9] p-3 text-xs leading-5 text-[#79520d]">Trước tiên, mở link này bằng <strong>Safari</strong>. Trình duyệt bên trong Facebook/Zalo không cài được webapp.</p> : null}
                  <InstallStep number="1" icon={<Share size={16} />} title="Chạm nút Chia sẻ" detail="Biểu tượng ô vuông có mũi tên hướng lên trong Safari." />
                  <InstallStep number="2" icon={<Smartphone size={16} />} title="Chọn Thêm vào Màn hình chính" detail="Nếu chưa thấy, kéo xuống cuối danh sách tác vụ." />
                  <InstallStep number="3" icon={<Check size={16} />} title="Bật Mở dưới dạng ứng dụng rồi nhấn Thêm" detail="Biểu tượng Tâm An Center sẽ xuất hiện cùng các ứng dụng khác." />
                </>
              ) : (
                <>
                  <InstallStep number="1" icon={<MoreVertical size={16} />} title="Mở menu Chrome" detail="Chạm dấu ba chấm ở góc trình duyệt." />
                  <InstallStep number="2" icon={<Download size={16} />} title="Chọn Cài đặt ứng dụng" detail="Một số máy hiển thị Thêm vào màn hình chính." />
                  <InstallStep number="3" icon={<Check size={16} />} title="Nhấn Cài đặt" detail="Sau đó mở Tâm An Center từ màn hình chính." />
                </>
              )}

              <button type="button" onClick={() => void copyCurrentLink()} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e7d6ca] px-4 py-2.5 text-xs font-semibold text-[#8f201c]">
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Đã sao chép link" : "Sao chép link để mở bằng trình duyệt"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function InstallStep({ number, icon, title, detail }: { number: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[#fdf8f3] p-3 ring-1 ring-[#eee1d8]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c64b32] text-xs font-bold text-white">{number}</span>
      <span className="mt-0.5 text-[#c64b32]">{icon}</span>
      <span className="min-w-0"><strong className="block text-xs">{title}</strong><span className="mt-0.5 block text-[11px] leading-5 text-[#786a63]">{detail}</span></span>
    </div>
  );
}
