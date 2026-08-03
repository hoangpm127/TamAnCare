"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Gift, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { setReferralAttribution } from "@/lib/referral-attribution";
import { formatMoney } from "@/lib/utils";

type ReferralOffer = {
  code: string;
  discountValue: number;
  minimumSpend: number;
  minimumServiceDurationMin: number | null;
  displayConstraint: string;
} | null;

export function ReferralLandingClient({ code, offer }: { code: string; offer: ReferralOffer }) {
  useEffect(() => {
    setReferralAttribution(code);
  }, [code]);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-[radial-gradient(circle_at_top,#ffe8d8_0%,#fffaf6_42%,#fffaf6_100%)] px-4 py-5 text-[#191414] sm:py-10">
      <div className="mx-auto w-full max-w-md space-y-3">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#eadbd1] bg-white shadow-xl">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#c22630] via-[#9f1d20] to-[#4d0c10] px-5 pb-6 pt-7 text-center text-white">
            <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/8" />
            <div className="absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-[#f5d982]/10" />
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
              <Gift size={25} />
            </span>
            <p className="relative mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffe3a8]">Một người bạn đã gửi tặng bạn</p>
            <h1 className="relative mt-1 text-2xl font-semibold tracking-tight">Lời mời trải nghiệm Tâm An Care</h1>
            <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 font-mono text-xs ring-1 ring-white/15">
              <BadgeCheck size={14} /> Mã {code}
            </span>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl bg-[#fff7df] p-4 text-center ring-1 ring-[#e3b23c]/45">
              <Sparkles className="mx-auto text-[#9f1d20]" size={22} />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#805914]">Quyền lợi dành cho bạn</p>
              {offer ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-[#9f1d20]">Giảm {formatMoney(offer.discountValue)}</p>
                  <p className="mt-1 text-xs leading-5 text-[#715943]">Cho lần trải nghiệm đầu tiên · {offer.displayConstraint || `đơn từ ${formatMoney(offer.minimumSpend)}`}</p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold leading-6 text-[#9f1d20]">Mã giới thiệu đã được ghi nhận. Hệ thống sẽ tự áp dụng ưu đãi đang còn hiệu lực.</p>
              )}
            </div>

            <div className="space-y-2.5 text-xs leading-5 text-[#554842]">
              <p className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /><span>Mã đã lưu trên điện thoại này trong 30 ngày và tự gắn vào booking.</span></p>
              <p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#9f1d20]" /><span>Bạn chỉ cần đăng nhập và xác minh OTP một lần khi muốn sử dụng ưu đãi.</span></p>
            </div>

            <div className="grid gap-2">
              <Link href="/booking" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#9f1d20] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#9f1d20]/20">
                <Sparkles size={16} /> Đặt lịch &amp; dùng ưu đãi <ArrowRight size={15} />
              </Link>
              <Link href="/tai-khoan?returnTo=%2Fbooking" className="flex w-full items-center justify-center gap-2 rounded-full border border-[#dfcec4] bg-white px-5 py-3 text-xs font-semibold text-[#6f211f]">
                <LogIn size={15} /> Đăng nhập nhanh trước khi đặt lịch
              </Link>
            </div>
          </div>
        </section>

        <PwaInstallPrompt />

        <p className="px-4 text-center text-[10px] leading-4 text-[#8a7a72]">Bạn vẫn có thể dùng toàn bộ chức năng ngay trên web mà không cần cài đặt.</p>
      </div>
    </main>
  );
}
