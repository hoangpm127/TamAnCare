"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Gift, Loader2, ShieldCheck } from "lucide-react";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { captureReferralAttribution } from "@/lib/referral-attribution";

type ReferralOffer = {
  code: string;
  discountValue: number;
  minimumSpend: number;
  minimumServiceDurationMin: number | null;
  displayConstraint: string;
} | null;

export function ReferralLandingClient({ code, offer }: { code: string; offer: ReferralOffer }) {
  const [captureState, setCaptureState] = useState<"saving" | "saved" | "error">("saving");

  useEffect(() => {
    let active = true;
    void captureReferralAttribution(code)
      .then((result) => {
        if (active) setCaptureState(result ? "saved" : "error");
      })
      .catch(() => {
        if (active) setCaptureState("error");
      });
    return () => { active = false; };
  }, [code]);

  return (
    <main className="min-h-[calc(100dvh-56px)] bg-[radial-gradient(circle_at_top,#ffe4d2_0%,#fdf8f3_48%,#fdf8f3_100%)] px-4 py-4 text-[#281b18] sm:py-8">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#e7d6ca] bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#b6403a] via-[#c64b32] to-[#4c191b] px-5 py-6 text-center text-white">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/8" />
          <div className="absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-[#e7c878]/10" />
          <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
            <Gift size={23} />
          </span>
          <p className="relative mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffe3a8]">Một người bạn đã gửi tặng bạn</p>
          <h1 className="relative mt-1 text-[1.75rem] font-bold leading-tight tracking-tight">Bạn nhận 200.000đ</h1>
          <p className="relative mt-2 text-xs leading-5 text-white/85">150.000đ quà thành viên mới + 50.000đ từ lời mời.</p>
        </div>

        <div className="space-y-3 p-4">
          <div className={`flex items-start gap-2 rounded-2xl px-3.5 py-3 text-xs leading-5 ring-1 ${captureState === "error" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
            {captureState === "saving" ? <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin" /> : captureState === "saved" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <ShieldCheck size={17} className="mt-0.5 shrink-0" />}
            <span>
              {captureState === "saving"
                ? "Đang lưu lời mời…"
                : captureState === "saved"
                  ? "Đã lưu lời mời trong 30 ngày. Thoát ra hoặc cài app cũng không mất quà."
                  : "Chưa lưu được lời mời. Hãy mở lại link này khi có mạng."}
            </span>
          </div>

          <PwaInstallPrompt compact />

          <Link href="/tai-khoan?returnTo=%2Fbooking" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c64b32] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#c64b32]/20">
            Đã cài? Tạo hồ sơ và đặt lịch <ArrowRight size={16} />
          </Link>

          <div className="space-y-1 text-center text-[11px] leading-5 text-[#74645c]">
            <p>Chỉ cần họ tên, số điện thoại và Mã PIN Tâm An 4 số.</p>
            {offer ? <p>Ưu đãi được áp dụng cho lần trải nghiệm đầu tiên đủ điều kiện.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
