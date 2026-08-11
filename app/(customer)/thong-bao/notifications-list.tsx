"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, Bell, Briefcase, Building2, CalendarClock, Check, CheckCheck, Gift, Info, Users, type LucideIcon } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead, useAllNotifications } from "@/lib/notification-store";
import { notificationTypeLabel } from "@/lib/labels";
import { NOTIFICATION_TONE_STYLES, presentNotification } from "@/lib/notification-presentation";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "BOOKING" | "BRANCH" | "INVITE" | "PROMO";

const TYPE_ICON: Record<string, LucideIcon> = {
  BOOKING: CalendarClock,
  PROMO: Gift,
  REMINDER: Bell,
  SYSTEM: Info,
  BUSINESS: Briefcase,
  INVITE: Users,
};

const FILTERS: { value: Filter; label: string; icon: LucideIcon }[] = [
  { value: "ALL", label: "Tất cả", icon: Bell },
  { value: "BOOKING", label: "Lịch & dịch vụ", icon: CalendarClock },
  { value: "BRANCH", label: "Cơ sở", icon: Building2 },
  { value: "INVITE", label: "Bạn bè mời", icon: Users },
  { value: "PROMO", label: "Khuyến mãi", icon: Gift },
];

export function NotificationsList() {
  const notifications = useAllNotifications();
  const [filter, setFilter] = useState<Filter>("ALL");
  const sorted = [...notifications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unreadCount = sorted.filter((item) => !item.read).length;
  const filtered = sorted.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "BOOKING") return item.type === "BOOKING";
    if (filter === "INVITE") return item.type === "INVITE";
    if (filter === "PROMO") return item.type === "PROMO";
    return ["REMINDER", "SYSTEM", "BUSINESS"].includes(item.type);
  });

  function markRead(id: string) {
    markNotificationRead(id);
  }

  function markAllRead() {
    markAllNotificationsRead();
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#e7d6ca] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold text-[#281b18]">Trung tâm thông báo</p><p className="mt-0.5 text-[10px] text-[#826f66]">{unreadCount} thông báo chưa đọc</p></div>
          <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="inline-flex items-center gap-1.5 rounded-full bg-[#f8ebe5] px-3 py-2 text-[11px] font-semibold text-[#c64b32] disabled:opacity-45"><CheckCheck size={14} /> Đọc tất cả</button>
        </div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((item) => { const Icon = item.icon; const count = sorted.filter((notification) => item.value === "ALL" || (item.value === "BOOKING" ? notification.type === "BOOKING" : item.value === "INVITE" ? notification.type === "INVITE" : item.value === "PROMO" ? notification.type === "PROMO" : ["REMINDER", "SYSTEM", "BUSINESS"].includes(notification.type))).length; return <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold", filter === item.value ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#68574f]")}><Icon size={13} /> {item.label}<span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", filter === item.value ? "bg-white/15" : "bg-[#f4eeea]")}>{count}</span></button>; })}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm">
        {filtered.map((item) => {
          const Icon = TYPE_ICON[item.type] ?? Info;
          const presentation = presentNotification(item.title, item.body);
          const tone = NOTIFICATION_TONE_STYLES[presentation.tone];
          const actionUrl = item.actionUrl?.startsWith("/check-in") ? "/don-cua-toi?tab=upcoming" : item.actionUrl;
          return (
            <article key={item.id} className={cn("flex gap-3 border-b border-l-4 px-4 py-3 last:border-b-0", tone.card, item.read && "bg-white/70")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.icon)}><Icon size={17} /></span>
              <div className="min-w-0 flex-1">
                {actionUrl ? <Link href={actionUrl} onClick={() => markRead(item.id)} className="block"><div className="flex items-start gap-1.5"><p className="min-w-0 flex-1 text-sm font-semibold leading-5">{presentation.title}</p>{!item.read ? <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone.dot)} /> : null}</div><span className={cn("mt-1.5 inline-flex rounded-full px-2 py-1 text-[9px] font-semibold", tone.badge)}>{presentation.label}</span><p className="mt-1 text-xs leading-5 text-[#68574f]">{presentation.body}</p><span className={cn("mt-2 inline-flex items-center gap-1 text-[10px] font-semibold", tone.action)}>{presentation.actionLabel} <ArrowUpRight size={11} /></span></Link> : <><div className="flex items-start gap-1.5"><p className="min-w-0 flex-1 text-sm font-semibold leading-5">{presentation.title}</p>{!item.read ? <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone.dot)} /> : null}</div><span className={cn("mt-1.5 inline-flex rounded-full px-2 py-1 text-[9px] font-semibold", tone.badge)}>{presentation.label}</span><p className="mt-1 text-xs leading-5 text-[#68574f]">{presentation.body}</p></>}
                <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] text-[#826f66]">{notificationTypeLabel(item.type)} · {format(item.createdAt, "HH:mm dd/MM")}</p>{!item.read ? <button type="button" onClick={() => markRead(item.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e7d6ca] px-2 py-1 text-[10px] font-semibold text-[#c64b32]"><Check size={11} /> Đánh dấu đã đọc</button> : <span className="inline-flex items-center gap-1 text-[10px] text-[#826f66]"><CheckCheck size={11} /> Đã đọc</span>}</div>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 ? <div className="p-10 text-center text-xs text-[#826f66]">Chưa có thông báo trong nhóm này.</div> : null}
      </div>
    </div>
  );
}
