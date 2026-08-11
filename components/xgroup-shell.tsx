"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Bell, Building2, CheckCheck, ChevronRight, CircleDollarSign, FileCheck2, FolderKanban, KeyRound, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useAdminSession } from "@/components/admin-session-provider";
import { NOTIFICATION_TONE_STYLES, presentNotification } from "@/lib/notification-presentation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/xgroup", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/xgroup/finance", label: "Tài chính", icon: CircleDollarSign },
  { href: "/xgroup/districts", label: "Địa bàn", icon: Building2 },
  { href: "/xgroup/affiliates", label: "Affiliate", icon: BadgePercent },
  { href: "/xgroup/assets", label: "Link · QR · Video", icon: FolderKanban },
  { href: "/xgroup/reconciliation", label: "Đối soát", icon: FileCheck2 },
] as const;

type Notice = { id: string; type: string; title: string; body: string; actionUrl: string | null; readAt: string | null; createdAt: string };

export function XgroupShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAdminSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/xgroup/notifications", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!active || !payload) return;
      setNotices(payload.notifications ?? []);
      setUnread(payload.unreadCount ?? 0);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const activeLabel = useMemo(() => NAV.find((item) => item.href === pathname)?.label ?? "Tổng quan", [pathname]);
  const primaryMobile = NAV.slice(0, 4);

  async function markRead(id?: string) {
    await fetch("/api/xgroup/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { notificationId: id } : { markAll: true }) });
    setNotices((current) => current.map((item) => !id || item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnread(id ? Math.max(0, unread - (notices.find((item) => item.id === id)?.readAt ? 0 : 1)) : 0);
  }

  async function logout() {
    await signOut();
    router.replace("/dang-nhap-quan-tri");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[#fbf2e7] pb-20 text-[#281b18] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-[#f1e5dd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 px-3 sm:px-5">
          <Link href="/xgroup" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#281b18] to-[#76551d] text-[#d9b65d] shadow-sm"><ShieldCheck size={18} /></span>
            <span className="min-w-0"><strong className="block truncate text-xs tracking-[0.08em]">XGROUP CONTROL TOWER</strong><small className="block truncate text-[9px] text-[#6d7f7a]">Tâm An Business · {activeLabel}</small></span>
          </Link>
          <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {NAV.map((item) => { const Icon = item.icon; const active = item.href === "/xgroup" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition", active ? "bg-[#4c191b] text-white" : "text-[#53625f] hover:bg-[#fbf2e7]")}><Icon size={14} />{item.label}</Link>; })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setNoticesOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7] text-[#76551d]" aria-label="Thông báo Xgroup"><Bell size={17} />{unread ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b72b31] px-1 text-[8px] font-bold text-white">{Math.min(99, unread)}</span> : null}</button>
            <button type="button" onClick={() => setMoreOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4c191b] text-white lg:hidden" aria-label="Mở menu"><Menu size={17} /></button>
            <div className="hidden max-w-[220px] items-center gap-2 rounded-full border border-[#f1e5dd] bg-white px-2.5 py-1.5 md:flex"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fbf2e7] text-[#76551d]"><ShieldCheck size={14} /></span><span className="min-w-0"><strong className="block truncate text-[10px]">{session?.displayName}</strong><small className="block truncate text-[8px] text-[#667a73]">{session?.title}</small></span></div>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f1e5dd] bg-white/96 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch">
          {primaryMobile.map((item) => { const Icon = item.icon; const active = item.href === "/xgroup" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center gap-1 py-2"><span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", active ? "bg-[#4c191b] text-white" : "text-[#72807d]")}><Icon size={16} /></span><span className={cn("text-[9px] font-semibold", active ? "text-[#4c191b]" : "text-[#72807d]")}>{item.label}</span></Link>; })}
          <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-1 flex-col items-center gap-1 py-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg text-[#72807d]"><Menu size={16} /></span><span className="text-[9px] font-semibold text-[#72807d]">Thêm</span></button>
        </div>
      </nav>

      {moreOpen ? <div className="fixed inset-0 z-50 bg-[#fbf2e7] p-4 pt-[calc(env(safe-area-inset-top)+1rem)] lg:hidden"><div className="mx-auto max-w-lg"><div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#281b18] to-[#76551d] p-4 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#e9ca74]">Xgroup Business</p><h2 className="mt-1 text-lg font-semibold">Trung tâm điều hành</h2><p className="mt-1 text-[10px] text-white/70">{session?.displayName} · {session?.branchLabel}</p></div><button type="button" onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X size={18} /></button></div><div className="mt-3 grid grid-cols-2 gap-2">{NAV.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-xl border border-[#f1e5dd] bg-white p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf2e7] text-[#76551d]"><Icon size={16} /></span><span className="text-[11px] font-semibold">{item.label}</span></Link>; })}</div><Link href="/bao-mat-quan-tri" className="mt-3 flex items-center gap-2 rounded-xl border border-[#f1e5dd] bg-white p-3 text-[11px] font-semibold"><KeyRound size={16} className="text-[#76551d]" /> Bảo mật hai lớp</Link><button type="button" onClick={() => void logout()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b72b31] px-4 py-3 text-xs font-semibold text-white"><LogOut size={15} /> Đăng xuất an toàn</button></div></div> : null}

      {noticesOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf2e7]">
          <header className="sticky top-0 z-10 border-b border-[#f1e5dd] bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
              <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7] text-[#76551d]"><Bell size={17} /></span><div><strong className="block text-sm">Cập nhật kinh doanh</strong><small className="text-[9px] text-[#6d7f7a]">Doanh thu · thanh toán · địa bàn · đối tác</small></div></div>
              <button type="button" onClick={() => setNoticesOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button>
            </div>
          </header>
          <main className="mx-auto max-w-2xl p-4">
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#4c191b] p-3 text-white"><div><p className="text-xs font-semibold">Việc cần theo dõi</p><p className="mt-0.5 text-[9px] text-white/65">{unread} cập nhật mới</p></div><button type="button" onClick={() => void markRead()} disabled={!unread} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[10px] font-semibold disabled:opacity-40"><CheckCheck size={13} /> Đã xem tất cả</button></div>
            <div className="space-y-2">
              {notices.map((notice) => {
                const presentation = presentNotification(notice.title, notice.body);
                const tone = NOTIFICATION_TONE_STYLES[presentation.tone];
                const NoticeIcon = notice.type === "FINANCE" || notice.type === "PAYMENT" ? CircleDollarSign : notice.type === "PROMOTION" ? BadgePercent : FileCheck2;
                return (
                  <article key={notice.id} className={cn("rounded-2xl border p-3", tone.card, notice.readAt && "bg-white/70 opacity-80")}>
                    <Link href={notice.actionUrl?.startsWith("/xgroup") ? notice.actionUrl : "/xgroup"} onClick={() => { void markRead(notice.id); setNoticesOpen(false); }} className="flex items-start gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.icon)}><NoticeIcon size={17} /></span>
                      <span className="min-w-0 flex-1"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold", tone.badge)}>{presentation.label}</span><strong className="mt-1 block text-xs leading-5">{presentation.title}</strong><span className="mt-1 block text-[11px] leading-5 text-[#5c6c68]">{presentation.body}</span><small className="mt-2 block text-[9px] text-[#899692]">{new Date(notice.createdAt).toLocaleString("vi-VN")}</small></span>
                      <ChevronRight size={14} className={cn("mt-3 shrink-0", tone.action)} />
                    </Link>
                  </article>
                );
              })}
              {!notices.length ? <p className="rounded-2xl border border-dashed border-[#e7d6ca] bg-white p-10 text-center text-xs text-[#667a73]">Chưa có việc mới.</p> : null}
            </div>
          </main>
        </div>
      ) : null}
    </main>
  );
}
