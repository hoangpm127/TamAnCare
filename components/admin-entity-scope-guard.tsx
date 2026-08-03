"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useAdminSession } from "@/components/admin-session-provider";

export function AdminEntityScopeGuard({ branchId, children }: { branchId: string; children: React.ReactNode }) {
  const { session } = useAdminSession();
  if (!session) return null;

  if (session.role !== "OWNER" && session.branchId !== branchId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><LockKeyhole size={23} /></span>
        <h1 className="mt-4 text-xl font-semibold">Hồ sơ ngoài phạm vi cơ sở</h1>
        <p className="mt-2 text-sm leading-6 text-[#68574f]">Tài khoản {session.displayName} chỉ được xem nhân sự thuộc {session.branchLabel}.</p>
        <Link href="/admin/therapists" className="mt-5 inline-flex rounded-full bg-[#c64b32] px-4 py-2.5 text-sm font-semibold text-white">Về danh sách KTV</Link>
      </div>
    );
  }

  return children;
}
