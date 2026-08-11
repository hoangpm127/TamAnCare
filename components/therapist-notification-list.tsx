"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCheck, CircleCheckBig, Clock3, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { NOTIFICATION_TONE_STYLES, presentNotification } from "@/lib/notification-presentation";
import { cn } from "@/lib/utils";

type WorkNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string | null;
};

export function TherapistNotificationList() {
  const [items, setItems] = useState<WorkNotification[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin-notifications", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setItems((payload.notifications ?? []) as WorkNotification[]);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    void fetch("/api/admin-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    void fetch("/api/admin-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-semibold"><Bell size={16} className="text-[#c64b32]" /> Cập nhật ca làm</h2>
          <p className="mt-0.5 text-[10px] text-[#826f66]">{unread} việc mới cần xem</p>
        </div>
        <button type="button" onClick={markAllRead} disabled={!unread} className="inline-flex items-center gap-1 rounded-full bg-[#f8ebe5] px-3 py-2 text-[10px] font-semibold text-[#c64b32] disabled:opacity-40"><CheckCheck size={13} /> Đã xem tất cả</button>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 20).map((item) => {
          const presentation = presentNotification(item.title, item.body);
          const tone = NOTIFICATION_TONE_STYLES[presentation.tone];
          const StatusIcon = presentation.tone === "SUCCESS" ? CircleCheckBig : presentation.tone === "PENDING" ? Clock3 : presentation.tone === "ATTENTION" ? TriangleAlert : Info;
          return (
            <article key={item.id} className={cn("rounded-xl border p-3", tone.card, item.read && "bg-white/70 opacity-80")}>
              <div className="flex items-start gap-2.5">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone.icon)}><StatusIcon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold", tone.badge)}>{presentation.label}</span>
                  {item.href ? <Link href={item.href} onClick={() => markRead(item.id)} className={cn("mt-1 block text-sm font-semibold", tone.action)}>{presentation.title}</Link> : <p className="mt-1 text-sm font-semibold">{presentation.title}</p>}
                  <p className="mt-1 text-xs leading-5 text-[#68574f]">{presentation.body}</p>
                  <p className="mt-1.5 text-[9px] text-[#826f66]">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                {!item.read ? <button type="button" onClick={() => markRead(item.id)} className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white", tone.action)} aria-label="Đánh dấu đã xem"><Check size={13} /></button> : null}
              </div>
            </article>
          );
        })}
        {items.length === 0 ? <p className="rounded-lg border border-dashed border-[#e7d6ca] p-5 text-center text-sm text-[#826f66]">Chưa có việc mới.</p> : null}
      </div>
    </>
  );
}
