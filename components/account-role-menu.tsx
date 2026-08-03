"use client";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

export function AccountRoleMenu() {
  return (
    <Link href="/dang-nhap-quan-tri" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fff7f3]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f]">
        <ShieldCheck size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Khu vực vận hành & đầu tư</span>
        <span className="block text-xs text-[#8a7a72]">Đăng nhập bằng tài khoản nội bộ được cấp</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[#c9b6ac]" />
    </Link>
  );
}
