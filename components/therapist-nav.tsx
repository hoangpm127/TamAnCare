"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, BriefcaseBusiness, CalendarDays, CircleDollarSign, LogOut, QrCode, UserRound, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TherapistNotificationList } from "@/components/therapist-notification-list";
import { TherapistQrCard } from "@/components/therapist-qr-card";
import { NavigationPendingIndicator } from "@/components/navigation-pending-indicator";
import { TherapistServiceAlert } from "@/components/therapist-service-alert";
import { forgetAdminWorkspace, rememberAdminWorkspace } from "@/lib/admin-workspace";

const NAV_ITEMS = [
  { href: "/therapist", label: "Lịch", icon: CalendarDays, exact: true },
  { href: "/therapist/business", label: "Business", icon: BriefcaseBusiness },
  { href: "/therapist/income", label: "Thu nhập", icon: CircleDollarSign },
  { href: "/therapist/operations", label: "Điều phối", icon: UsersRound },
  { href: "/therapist/me", label: "Tôi", icon: UserRound },
];

type Props = { qrDataUrl: string | null; therapistName: string; branchLabel: string };

export function TherapistNav({ qrDataUrl, therapistName, branchLabel }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [panel, setPanel] = useState<"qr" | "notifications" | null>(null);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-notifications", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setUnread((payload.notifications ?? []).filter((item: { read?: boolean }) => !item.read).length);
    } catch {
      // A transient notification failure must not interrupt the KTV workspace.
    }
  }, []);

  useEffect(() => {
    rememberAdminWorkspace(pathname);
  }, [pathname]);

  useEffect(() => {
    queueMicrotask(() => void loadUnread());
    const timer = window.setInterval(loadUnread, 10_000);
    return () => window.clearInterval(timer);
  }, [loadUnread]);

  async function logout() {
    await fetch("/api/admin-auth/session", { method: "DELETE" });
    forgetAdminWorkspace();
    router.replace("/dang-nhap-quan-tri");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#e7d6ca] bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-3 sm:px-6">
          <Link href="/therapist" className="tap-feedback relative min-w-0 rounded-xl">
            <span className="block truncate text-sm font-semibold tracking-wide">KTV Tâm An Center</span>
            <span className="block truncate text-[8px] text-[#826f66]">{branchLabel}</span>
            <NavigationPendingIndicator />
          </Link>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPanel("qr")} disabled={!qrDataUrl} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7] text-[#76551d] disabled:opacity-40" aria-label="Mở QR KTV"><QrCode size={17} /></button>
            <button type="button" onClick={() => { setPanel("notifications"); setUnread(0); }} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]" aria-label="Mở thông báo">
              <Bell size={17} />
              {unread ? <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#c64b32] px-1 text-[7px] font-bold text-white">{Math.min(99, unread)}</span> : null}
            </button>
            <button type="button" onClick={() => void logout()} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7d6ca] text-[#826f66]" aria-label="Đăng xuất tài khoản KTV"><LogOut size={15} /></button>
          </div>
        </div>
      </header>
      <TherapistServiceAlert />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7d6ca] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl items-stretch justify-around">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setPanel(null)} className="tap-feedback relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2"><span className={cn("flex h-7 w-7 items-center justify-center rounded-full", active && "bg-[#c64b32]")}><Icon size={16} className={active ? "text-white" : "text-[#826f66]"} /></span><span className={cn("truncate text-[8px] font-medium", active ? "text-[#c64b32]" : "text-[#826f66]")}>{item.label}</span><NavigationPendingIndicator className="rounded-none" /></Link>;
          })}
        </div>
      </nav>

      {panel ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true">
        <button type="button" className="absolute inset-0" onClick={() => setPanel(null)} aria-label="Đóng" />
        <section className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-white p-4 shadow-2xl sm:rounded-[1.75rem] sm:p-5">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Cổng KTV</p><h2 className="text-base font-semibold">{panel === "qr" ? "QR phục vụ của tôi" : "Thông báo công việc"}</h2></div><button type="button" onClick={() => setPanel(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6efeb] text-[#756861]" aria-label="Đóng cửa sổ"><X size={17} /></button></div>
          {panel === "qr" && qrDataUrl ? <TherapistQrCard dataUrl={qrDataUrl} therapistName={therapistName} branchLabel={branchLabel} compact /> : null}
          {panel === "notifications" ? <TherapistNotificationList /> : null}
        </section>
      </div> : null}
    </>
  );
}
