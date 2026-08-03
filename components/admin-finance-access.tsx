"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { AdminFinanceCenter } from "@/components/admin-finance-center";
import { useAdminSession } from "@/components/admin-session-provider";

export function AdminFinanceAccess() {
  const { session } = useAdminSession();
  if (session?.role !== "INVESTOR") return <AdminFinanceCenter />;

  return (
    <main className="min-h-[70vh] bg-[#160f0e] px-4 py-12 text-white">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#d6b45e]/20 bg-white/5 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d6b45e]/10 text-[#d6b45e]"><LockKeyhole size={22} /></span>
        <h1 className="mt-4 text-xl font-semibold">Bill chi tiết thuộc nghiệp vụ nội bộ</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">Vai trò Nhà đầu tư chỉ xem báo cáo tổng hợp, không truy cập thông tin khách hàng, bill hay các khoản chi có chứng từ nội bộ.</p>
        <Link href="/admin" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#d6b45e] px-5 py-2.5 text-sm font-semibold text-[#2b1b13]"><ArrowLeft size={15} /> Về báo cáo đầu tư</Link>
      </div>
    </main>
  );
}
