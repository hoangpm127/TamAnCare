"use client";

import Link from "next/link";
import { LogIn, Settings, UserRound } from "lucide-react";
import { useCustomerAccount } from "@/lib/customer-account";
import { useCustomerProfile } from "@/lib/customer-profile-store";
import { calculateWalletTotalExpense, useWalletLedger } from "@/lib/wallet-ledger";
import { formatMoney } from "@/lib/utils";

const VIP_THRESHOLD = 3_000_000;

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AccountProfileCard() {
  const profile = useCustomerProfile();
  const { account, ready } = useCustomerAccount();
  const ledgerEntries = useWalletLedger();
  const displayName = profile.fullName || account?.fullName || "Khách Tâm An";
  const displayPhone = profile.phone || account?.phone || (ready ? "Đăng nhập để đồng bộ hồ sơ" : "Đang tải hồ sơ...");
  const hasIdentity = Boolean(profile.fullName || account?.fullName);
  const totalExpense = calculateWalletTotalExpense(ledgerEntries);
  const tierProgress = Math.min(100, Math.round((totalExpense / VIP_THRESHOLD) * 100));
  const remainingToVip = Math.max(0, VIP_THRESHOLD - totalExpense);

  return (
    <section className="rounded-xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#c64b32] text-base font-semibold text-white">
          {hasIdentity ? initials(displayName) : <UserRound size={22} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{displayName}</p>
          <p className="text-xs text-[#68574f]">{displayPhone}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {ready && !account ? (
            <Link
              href="/tai-khoan?mode=login&returnTo=%2Ftoi"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#ad3f2b]"
            >
              <LogIn size={15} />
              Đăng nhập
            </Link>
          ) : null}
          <Link
            href="/toi/cai-dat"
            aria-label="Cài đặt thông tin cá nhân"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32] transition hover:bg-[#f9ddd7]"
          >
            <Settings size={19} />
          </Link>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 divide-x divide-[#eee0d6] border-t border-[#eee0d6] pt-3 text-center">
        <div>
          <p className="text-sm font-semibold">{formatMoney(totalExpense)}</p>
          <p className="mt-0.5 text-[11px] text-[#826f66]">Tổng chi tiêu</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{Math.max(profile.totalVisits, account?.totalVisits ?? 0)}</p>
          <p className="mt-0.5 text-[11px] text-[#826f66]">Lần ghé</p>
        </div>
        <div>
          <p className="truncate px-1 text-sm font-semibold">{profile.favoriteTherapist}</p>
          <p className="mt-0.5 text-[11px] text-[#826f66]">KTV yêu thích</p>
        </div>
      </div>

      <div className="mt-3 border-t border-[#eee0d6] pt-3">
        <div className="flex items-center justify-between text-xs text-[#826f66]"><span>Tiến độ hạng thành viên</span><span>VIP</span></div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eee0d6]">
          <div className="h-full rounded-full bg-[#c64b32]" style={{ width: `${tierProgress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-[#826f66]">Thêm <strong className="text-[#c64b32]">{formatMoney(remainingToVip)}</strong> để lên hạng VIP.</p>
      </div>
    </section>
  );
}
