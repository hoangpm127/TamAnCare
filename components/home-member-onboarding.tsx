"use client";

import Link from "next/link";
import { ArrowRight, BadgePercent, CalendarCheck2, Gift, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useReferralAttribution } from "@/lib/referral-attribution";

export function HomeMemberOnboarding() {
  const referralCode = useReferralAttribution();

  return (
    <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-10" aria-labelledby="member-onboarding-title">
      <div className="overflow-hidden rounded-2xl border border-[#d7b36c]/55 bg-white shadow-[0_12px_30px_rgba(76,25,27,0.12)]">
        <div className="bg-gradient-to-r from-[#6f211f] via-[#a43b30] to-[#d05c39] px-4 py-4 text-white sm:px-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f4d98e]">
            {referralCode ? <BadgePercent size={12} /> : <Gift size={12} />}
            {referralCode ? "Lời mời Affiliate đã được ghi nhận" : "Dành cho khách hàng mới"}
          </p>
          <h2 id="member-onboarding-title" className="mt-2 text-lg font-semibold leading-tight">
            Bạn mới đến TÂM AN CENTER?
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/82 sm:text-sm">
            {referralCode
              ? "Đăng ký hoặc đăng nhập ngay để gắn quyền lợi người mới và lời mời Affiliate vào tài khoản, tránh mất voucher khi đóng rồi mở lại app."
              : "Đăng ký bằng tên, số điện thoại và Mã PIN 4 số để giữ ưu đãi thành viên, xem lại lịch hẹn và sử dụng voucher thuận tiện hơn."}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold leading-4 text-[#5f4d45] sm:text-xs">
            <span className="rounded-xl bg-[#fff6df] px-2 py-2.5"><Gift className="mx-auto mb-1 text-[#a85f29]" size={15} />Giữ ưu đãi 150K</span>
            <span className="rounded-xl bg-[#f9ece6] px-2 py-2.5"><ShieldCheck className="mx-auto mb-1 text-[#a43b30]" size={15} />Giữ quyền lợi Affiliate</span>
            <span className="rounded-xl bg-[#fff8f1] px-2 py-2.5"><CalendarCheck2 className="mx-auto mb-1 text-[#76551d]" size={15} />Xem lại lịch hẹn</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href="/tai-khoan?returnTo=%2Fbooking"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#bd4638] to-[#852724] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#6f211f]/20"
            >
              <UserPlus size={17} /> Đăng ký / Đăng nhập <ArrowRight size={15} />
            </Link>
            <Link
              href="/booking"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d9b66b] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#76551d]"
            >
              <LogIn size={17} /> Đặt nhanh không cần tài khoản
            </Link>
          </div>
          <p className="mt-2 text-center text-[10px] leading-4 text-[#786a63]">
            Không cần voucher? Bạn có thể bỏ qua đăng nhập và đặt lịch trực tiếp theo giá thường.
          </p>
        </div>
      </div>
    </section>
  );
}
