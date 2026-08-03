"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, ChevronRight, Clock3, ReceiptText, Volume2, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type ActiveService = {
  bookingCode: string;
  referenceCode: string;
  customerName: string;
  serviceName: string;
  branchLabel: string;
  startedAt: string;
  durationMin: number;
  plannedEndAt: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  usedPackage: boolean;
};

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function clock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function TherapistServiceAlert() {
  const [services, setServices] = useState<ActiveService[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedEnd, setDismissedEnd] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/therapist/active-service", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch {
      // Đồng hồ cục bộ vẫn tiếp tục chạy khi mạng chập chờn.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const poller = window.setInterval(load, 5_000);
    const ticker = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearInterval(poller); window.clearInterval(ticker); };
  }, [load]);

  useEffect(() => {
    const unlock = () => {
      const AudioCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!AudioCtor) return;
      audioRef.current ??= new AudioCtor();
      void audioRef.current.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const primary = useMemo(() => services
    .map((service) => ({ service, remaining: Math.ceil((new Date(service.plannedEndAt).getTime() - now) / 1000) }))
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null, [now, services]);

  useEffect(() => {
    if (!primary) return;
    const { service, remaining } = primary;
    const kind = remaining <= 0 ? "ended" : remaining <= 180 ? "three-minutes" : null;
    if (!kind) return;
    const key = `tt-ktv-alert:${kind}:${service.bookingCode}:${service.startedAt}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");

    const audio = audioRef.current;
    if (audio?.state === "running") {
      const tones = kind === "ended" ? [523, 392, 330] : [660, 784, 880];
      tones.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.22;
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.2);
      });
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const message = new SpeechSynthesisUtterance(kind === "ended" ? "Ca phục vụ đã đủ thời lượng." : "Ca phục vụ còn ba phút.");
        message.lang = "vi-VN";
        message.rate = 0.92;
        message.volume = 0.85;
        window.speechSynthesis.speak(message);
      }
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(kind === "ended" ? "Đã đủ thời lượng phục vụ" : "Ca còn 3 phút", {
        body: `${service.customerName} · ${service.serviceName}`,
        tag: key,
      });
    }
  }, [primary]);

  if (!primary || primary.remaining > 180) return null;
  const { service, remaining } = primary;
  const ended = remaining <= 0;
  const detailHref = `/therapist/bookings/${encodeURIComponent(service.bookingCode)}`;

  return (
    <>
      <Link href={detailHref} className={`sticky top-14 z-30 mx-auto flex max-w-4xl items-center gap-2 px-3 py-2 text-white shadow-lg ${ended ? "bg-[#8f151a]" : "bg-[#805914]"}`}>
        {ended ? <BellRing size={16} className="shrink-0 animate-pulse" /> : <Clock3 size={16} className="shrink-0" />}
        <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{ended ? "Đã đủ thời lượng phục vụ" : `Còn ${clock(remaining)} · chuẩn bị kết thúc ca`}</strong><small className="block truncate text-[9px] text-white/75">{service.customerName} · {service.serviceName}</small></span>
        <ChevronRight size={16} className="shrink-0" />
      </Link>

      {ended && dismissedEnd !== service.bookingCode ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 sm:items-center sm:p-5">
          <section className="w-full max-w-lg rounded-t-[2rem] bg-[#fffaf6] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center shadow-2xl sm:rounded-[2rem]">
            <button type="button" onClick={() => setDismissedEnd(service.bookingCode)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#8a7a72]" aria-label="Thu gọn thông báo"><X size={15} /></button>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f]"><Volume2 size={25} /></span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d13f1f]">Tâm An Care</p>
            <h2 className="mt-1 text-xl font-semibold">Đã đủ thời lượng phục vụ</h2>
            <p className="mt-2 text-sm leading-6 text-[#665b55]">Ca của <strong>{service.customerName}</strong> đã đủ {service.durationMin} phút. Mời KTV khéo léo kết thúc liệu trình, hỗ trợ khách chuẩn bị và hướng dẫn đối soát Bill tại quầy.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center text-[9px] text-[#8a7a72]"><span>Tổng Bill<strong className="mt-1 block text-xs text-[#191414]">{formatMoney(service.totalAmount)}</strong></span><span>Đã cọc/thu<strong className="mt-1 block text-xs text-[#16784a]">{formatMoney(service.paidAmount)}</strong></span><span>Còn lại<strong className="mt-1 block text-xs text-[#d13f1f]">{service.usedPackage ? "Lượt gói" : formatMoney(service.dueAmount)}</strong></span></div>
            <Link href={detailHref} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-4 py-3 text-sm font-semibold text-white"><ReceiptText size={16} /> Mở ca & Bill cần đối soát</Link>
            <p className="mt-3 text-[10px] leading-4 text-[#8a7a72]">Tip KTV được khách trao trực tiếp, tách riêng và không cộng vào Bill dịch vụ.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
