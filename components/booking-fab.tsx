"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Handshake, Loader2, Plus, Sparkles, UserPlus, UserRound, Users, X } from "lucide-react";
import { clearBookingUiDraft } from "@/lib/booking-ui-draft";

const BOTTOM_NAV_HEIGHT = 84;
const FAB_SIZE = 48;
const FAB_MARGIN = 8;
const FAB_POSITION_KEY = "tam-an-booking-fab-position-v1";

type FabPosition = { x: number; y: number };

function clampFabPosition(position: FabPosition): FabPosition {
  const maxX = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxY = Math.max(FAB_MARGIN, window.innerHeight - BOTTOM_NAV_HEIGHT - FAB_SIZE - FAB_MARGIN);
  return {
    x: Math.min(Math.max(position.x, FAB_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FAB_MARGIN), maxY),
  };
}

function BookingChoice({ trigger }: { trigger: "fab" | "hero" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [fabPosition, setFabPosition] = useState<FabPosition | null>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    lastPosition: FabPosition;
  } | null>(null);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    if (trigger !== "fab") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(FAB_POSITION_KEY);
        if (raw) setFabPosition(clampFabPosition(JSON.parse(raw) as FabPosition));
      } catch {
        window.localStorage.removeItem(FAB_POSITION_KEY);
      }
    });
    function handleResize() {
      setFabPosition((current) => current ? clampFabPosition(current) : current);
    }
    window.addEventListener("resize", handleResize);
    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [trigger]);

  function startFabDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left, y: rect.top };
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
      lastPosition: origin,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveFab(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
    event.preventDefault();
    drag.moved = true;
    const next = clampFabPosition({ x: drag.originX + deltaX, y: drag.originY + deltaY });
    drag.lastPosition = next;
    setFabPosition(next);
  }

  function finishFabDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      suppressClickUntil.current = Date.now() + 350;
      window.localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(drag.lastPosition));
    }
    dragState.current = null;
  }

  function goTo(path: string) {
    if (navigatingTo) return;
    setNavigatingTo(path);
    if (path.startsWith("/booking")) clearBookingUiDraft(true);
    router.push(path);
  }

  return (
    <>
      {trigger === "fab" ? (
        <div
          className={open ? "hidden" : "fixed z-50"}
          style={fabPosition ? { left: fabPosition.x, top: fabPosition.y } : { bottom: BOTTOM_NAV_HEIGHT + 10, right: FAB_MARGIN }}
        >
          <button
            type="button"
            onClick={(event) => {
              if (Date.now() < suppressClickUntil.current) {
                event.preventDefault();
                return;
              }
              setOpen(true);
            }}
            onPointerDown={startFabDrag}
            onPointerMove={moveFab}
            onPointerUp={finishFabDrag}
            onPointerCancel={finishFabDrag}
            aria-label="Đặt dịch vụ; giữ và kéo để di chuyển nút"
            title="Chạm để đặt lịch · Giữ và kéo để di chuyển"
            className="relative flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-[#9f1d20] text-white shadow-lg shadow-[#9f1d20]/40 transition active:cursor-grabbing active:scale-95"
          >
            <span className="absolute top-1.5 flex gap-0.5" aria-hidden="true"><i className="h-0.5 w-0.5 rounded-full bg-white/55" /><i className="h-0.5 w-0.5 rounded-full bg-white/55" /><i className="h-0.5 w-0.5 rounded-full bg-white/55" /></span>
            <Plus size={19} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#c22630] to-[#8f151a] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/30 ring-1 ring-white/10"
        >
          Đặt lịch ngay <ArrowRight size={15} />
        </button>
      )}

      {open && typeof document !== "undefined" ? createPortal((
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
          <button type="button" aria-label="Đóng" className="absolute inset-0 bg-[#191414]/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[2rem] border border-[#d8b46a]/55 bg-gradient-to-b from-[#fffdf9] to-[#fff8f2] px-4 pb-5 pt-5 shadow-[0_24px_70px_rgba(44,24,19,0.38)] ring-1 ring-white/70">
            {navigatingTo ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#fffaf6]/90 text-center backdrop-blur-sm" role="status" aria-live="polite">
                <Loader2 className="animate-spin text-[#9f1d20]" size={27} />
                <p className="text-sm font-semibold text-[#4d2922]">Đang mở hình thức đặt lịch…</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#2b1916] text-white shadow-sm transition hover:bg-[#4d2718]"
            >
              <X size={16} />
            </button>

            <div className="px-3 pb-3 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2e3d4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f241d]">
                <Sparkles size={11} /> Đặt lịch nhanh
              </span>
              <h2 className="mt-2 whitespace-nowrap text-[17px] font-semibold tracking-tight text-[#241615]">Hình thức đặt lịch bạn muốn?</h2>
            </div>

            <div className="mx-auto w-full max-w-[320px]">
              <div className="grid grid-cols-[1.05fr_0.95fr] grid-rows-2 gap-2.5">
                <button type="button" onClick={() => goTo("/booking")} className="group relative row-span-2 min-h-[230px] overflow-hidden rounded-[30px_16px_26px_16px] border border-[#e4bd9d] bg-gradient-to-br from-[#fff9f2] via-[#f8e2cf] to-[#efc8aa] p-4 text-left text-[#351d18] shadow-[0_12px_26px_rgba(91,48,31,0.14)] transition active:scale-[0.98]">
                  <span className="pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full border-[16px] border-white/35" />
                  <span className="pointer-events-none absolute bottom-5 right-4 h-4 w-4 rounded-full bg-[#c94b46]/20" />
                  <span className="pointer-events-none absolute bottom-10 right-9 h-2.5 w-2.5 rounded-full bg-[#b9862c]/35" />
                  <span className="relative flex h-full flex-col">
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex h-12 w-12 -rotate-3 items-center justify-center rounded-[18px_12px_18px_12px] bg-white text-[#9f1d20] shadow-sm ring-1 ring-[#9f1d20]/10 transition group-hover:rotate-0"><UserRound size={21} /></span>
                      <span className="rounded-full bg-white/65 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#9f1d20]">Riêng tư</span>
                    </span>
                    <span className="my-auto space-y-1.5 py-3">
                      <span className="block rounded-full bg-white/55 px-2.5 py-1.5 text-[9px] font-semibold text-[#6f3a2f]">Tự chọn dịch vụ & KTV</span>
                      <span className="block rounded-full bg-white/45 px-2.5 py-1.5 text-[9px] font-semibold text-[#6f3a2f]">Chủ động khung giờ phù hợp</span>
                    </span>
                    <span className="mt-auto">
                      <strong className="block text-lg font-bold tracking-tight">Cá nhân</strong>
                      <small className="mt-1 block text-[10px] leading-4 text-[#745c51]">Đặt lịch theo đúng nhu cầu và nhịp nghỉ ngơi của riêng bạn.</small>
                      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#9f1d20]">Chọn lịch <ArrowRight size={12} /></span>
                    </span>
                  </span>
                </button>

                <button type="button" onClick={() => goTo("/booking?invite=friend")} className="group relative min-h-[110px] overflow-hidden rounded-[16px_28px_16px_24px] bg-gradient-to-br from-[#cf625b] to-[#a92e32] p-3 text-left text-white shadow-[0_10px_22px_rgba(122,27,29,0.2)] transition active:scale-[0.98]">
                  <span className="pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full bg-white/[0.08]" />
                  <span className="relative flex items-center gap-2.5">
                    <span className="flex h-10 w-10 rotate-3 items-center justify-center rounded-[14px_18px_12px_18px] bg-white/12 text-[#ffe0b0] ring-1 ring-white/10 transition group-hover:rotate-0"><UserPlus size={18} /></span>
                    <span className="min-w-0"><strong className="block text-sm font-bold">Mời bạn</strong><small className="mt-0.5 block text-[9px] text-white/70">Đi cùng vui hơn</small></span>
                  </span>
                  <span className="absolute bottom-2.5 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/10"><ArrowRight size={12} /></span>
                </button>

                <button type="button" onClick={() => goTo("/booking?invite=boss")} className="group relative min-h-[110px] overflow-hidden rounded-[26px_16px_28px_16px] bg-gradient-to-br from-[#71352d] to-[#3d1d1a] p-3 text-left text-white shadow-[0_10px_22px_rgba(44,25,23,0.22)] transition active:scale-[0.98]">
                  <span className="pointer-events-none absolute -bottom-5 -left-4 h-16 w-16 rounded-full border-[10px] border-[#f5d982]/10" />
                  <span className="relative flex items-center gap-2.5">
                    <span className="flex h-10 w-10 -rotate-3 items-center justify-center rounded-[18px_12px_18px_12px] bg-white/10 text-[#f5d982] ring-1 ring-white/10 transition group-hover:rotate-0"><Handshake size={18} /></span>
                    <span className="min-w-0"><strong className="block text-sm font-bold">Mời sếp</strong><small className="mt-0.5 block text-[9px] text-white/65">Kín đáo · gần nhau</small></span>
                  </span>
                  <span className="absolute bottom-2.5 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/10"><ArrowRight size={12} /></span>
                </button>
              </div>

              <button type="button" onClick={() => goTo("/doanh-nghiep")} className="group relative mt-2.5 flex min-h-[88px] w-full items-center gap-3 overflow-hidden rounded-[22px_30px_22px_30px] border border-[#d5ad5b]/45 bg-gradient-to-r from-[#2b1917] via-[#211311] to-[#160d0c] px-4 py-3 text-left text-white shadow-[0_12px_26px_rgba(32,18,15,0.28)] transition active:scale-[0.99]">
                <span className="pointer-events-none absolute -right-5 -top-9 h-24 w-24 rounded-full border-[14px] border-[#f5d982]/10" />
                <span className="flex h-12 w-12 shrink-0 rotate-2 items-center justify-center rounded-[16px_20px_14px_20px] bg-[#f5d982]/12 text-[#f5d982] shadow-sm ring-1 ring-[#f5d982]/20 transition group-hover:rotate-0"><Briefcase size={21} /></span>
                <span className="relative min-w-0 flex-1"><strong className="block text-sm font-bold text-[#f7df9a]">Tâm An Business</strong><small className="mt-1 block text-[9px] text-white/65">Sức khỏe định kỳ cho cả công ty</small></span>
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5d982] text-[#321d18] shadow-sm"><ArrowRight size={14} /></span>
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#8a7a72]">
              <Users size={12} className="shrink-0 text-[#9f1d20]" /> Hơn 500 khách hàng & doanh nghiệp đã tin dùng.
            </div>
          </div>
        </div>
      ), document.body) : null}
    </>
  );
}

export function BookingHeroCta() {
  return <BookingChoice trigger="hero" />;
}

export function BookingFab() {
  return <BookingChoice trigger="fab" />;
}
