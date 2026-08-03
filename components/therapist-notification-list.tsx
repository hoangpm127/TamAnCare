"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
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
          <h2 className="flex items-center gap-1.5 font-semibold"><Bell size={16} className="text-[#c64b32]" /> Thông báo công việc</h2>
          <p className="mt-0.5 text-[10px] text-[#826f66]">{unread} thông báo chưa đọc</p>
        </div>
        <button type="button" onClick={markAllRead} disabled={!unread} className="inline-flex items-center gap-1 rounded-full bg-[#f8ebe5] px-3 py-2 text-[10px] font-semibold text-[#c64b32] disabled:opacity-40"><CheckCheck size={13} /> Đọc tất cả</button>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 20).map((item) => (
          <article key={item.id} className={cn("rounded-lg border p-3", item.read ? "border-[#f2e7df] bg-[#fdf8f3]" : "border-[#e7bbb2] bg-[#f8ebe5]") }>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{item.href ? <Link href={item.href} onClick={() => markRead(item.id)} className="text-sm font-semibold text-[#c64b32]">{item.title}</Link> : <p className="text-sm font-semibold">{item.title}</p>}<p className="mt-1 text-xs leading-5 text-[#68574f]">{item.body}</p><p className="mt-1 text-[9px] text-[#826f66]">{new Date(item.createdAt).toLocaleString("vi-VN")}</p></div>
              {!item.read ? <button type="button" onClick={() => markRead(item.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#c64b32]" aria-label="Đánh dấu đã đọc"><Check size={13} /></button> : null}
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="rounded-lg border border-dashed border-[#e7d6ca] p-5 text-center text-sm text-[#826f66]">Chưa có thông báo mới.</p> : null}
      </div>
    </>
  );
}
