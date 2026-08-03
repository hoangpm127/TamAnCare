"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useAllNotifications } from "@/lib/notification-store";

export function NotificationMenuRow() {
  const list = useAllNotifications();
  const unreadCount = list.filter((item) => !item.read).length;

  return (
    <Link href="/thong-bao" className="flex items-center gap-3 border-b border-[#f1e5dd] px-4 py-3 last:border-b-0 hover:bg-[#fff7f3]">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff2ef] text-[#9f1d20]">
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b51f24] px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#191414]">Thông báo</span>
        <span className="block truncate text-xs text-[#8a7a72]">Lịch hẹn & ưu đãi mới</span>
      </span>
      <ChevronRight className="shrink-0 text-[#c9b6ac]" size={18} />
    </Link>
  );
}
