"use client";

import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
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
    <section className="rounded-xl border border-[#eadbd1] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#9f1d20] text-base font-semibold text-white">
          {hasIdentity ? initials(displayName) : <UserRound size={22} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{displayName}</p>
          <p className="text-xs text-[#665b55]">{displayPhone}</p>
        </div>
        <Link
          href={account ? "/toi/cai-dat" : "/tai-khoan"}
          aria-label="Cài đặt thông tin cá nhân"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff2ef] text-[#9f1d20] transition hover:bg-[#f9ddd7]"
        >
          <Settings size={19} />
        </Link>
      </div>

      <div className="mt-3.5 grid grid-cols-3 divide-x divide-[#f1e5dd] border-t border-[#f1e5dd] pt-3 text-center">
        <div>
          <p className="text-sm font-semibold">{formatMoney(totalExpense)}</p>
          <p className="mt-0.5 text-[11px] text-[#8a7a72]">Tổng chi tiêu</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{Math.max(profile.totalVisits, account?.totalVisits ?? 0)}</p>
          <p className="mt-0.5 text-[11px] text-[#8a7a72]">Lần ghé</p>
        </div>
        <div>
          <p className="truncate px-1 text-sm font-semibold">{profile.favoriteTherapist}</p>
          <p className="mt-0.5 text-[11px] text-[#8a7a72]">KTV yêu thích</p>
        </div>
      </div>

      <div className="mt-3 border-t border-[#f1e5dd] pt-3">
        <div className="flex items-center justify-between text-xs text-[#8a7a72]"><span>Tiến độ hạng thành viên</span><span>VIP</span></div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f1e5dd]">
          <div className="h-full rounded-full bg-[#9f1d20]" style={{ width: `${tierProgress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-[#8a7a72]">Thêm <strong className="text-[#9f1d20]">{formatMoney(remainingToVip)}</strong> để lên hạng VIP.</p>
      </div>
    </section>
  );
}
