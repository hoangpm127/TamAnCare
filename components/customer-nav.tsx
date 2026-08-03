"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BadgePercent,
  CalendarCheck,
  ChevronLeft,
  CircleDollarSign,
  CircleUserRound,
  Gift,
  Home,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { useAllNotifications } from "@/lib/notification-store";
import { cn } from "@/lib/utils";
import { BookingFab } from "@/components/booking-fab";
import { clearBookingUiDraft } from "@/lib/booking-ui-draft";
import { ActiveServiceBanner } from "@/components/active-service-banner";
import { NavigationPendingIndicator } from "@/components/navigation-pending-indicator";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/uu-dai", label: "Ưu đãi", icon: Gift },
  { href: "/booking", label: "Đặt lịch", icon: CalendarCheck },
  { href: "/ru-ban", label: "Affiliate", icon: BadgePercent },
  { href: "/toi", label: "Tôi", icon: CircleUserRound },
];

const HIDE_BOTTOM_NAV_PREFIXES = ["/booking/success", "/review", "/office", "/chat"];
const HIDE_FAB_PREFIXES = [
  ...HIDE_BOTTOM_NAV_PREFIXES,
  "/booking",
  "/doanh-nghiep",
  "/tai-khoan",
  "/dieu-khoan",
  "/chinh-sach-rieng-tu",
  "/chinh-sach-dat-lich",
];

function CustomerTopbar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const notificationsList = useAllNotifications();
  const unreadCount = notificationsList.filter((item) => !item.read).length;
  const showBack = pathname !== "/";

  return (
    <header className="sticky top-0 z-40 border-b border-[#eadbd1] bg-white/95 shadow-[0_1px_12px_rgba(159,29,32,0.06)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-1">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Quay lại"
              className="tap-feedback flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#191414] hover:bg-[#fff2ef] sm:h-9 sm:w-9"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <Link href="/" className="tap-feedback relative flex min-w-0 items-center gap-2 rounded-xl text-base font-semibold tracking-wide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-64.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <span className="truncate">Tâm An Care</span>
            <NavigationPendingIndicator />
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/check-in"
            className="tap-feedback relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f] sm:h-9 sm:w-9"
            aria-label="Check-in tại cơ sở"
          >
            <QrCode size={16} />
            <NavigationPendingIndicator />
          </Link>
          <Link
            href="/chat"
            className="tap-feedback relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f] sm:h-9 sm:w-9"
            aria-label="Chat với cơ sở"
          >
            <MessageCircle size={16} />
            <NavigationPendingIndicator />
          </Link>
          <Link
            href="/vi"
            className="tap-feedback relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f] sm:h-9 sm:w-9"
            aria-label="Thu - Chi của tôi"
          >
            <CircleDollarSign size={16} />
            <NavigationPendingIndicator />
          </Link>
          <Link
            href="/thong-bao"
            className="tap-feedback relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f] sm:h-9 sm:w-9"
            aria-label="Thông báo"
          >
            <Bell size={16} />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b51f24] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            ) : null}
            <NavigationPendingIndicator />
          </Link>
        </div>
      </div>
    </header>
  );
}

function CustomerBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadbd1] bg-white/95 shadow-[0_-1px_12px_rgba(159,29,32,0.06)] backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => clearBookingUiDraft(true)}
              className="tap-feedback relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                  active ? "bg-[#d13f1f] shadow-sm shadow-[#d13f1f]/30" : ""
                )}
              >
                <Icon size={19} className={active ? "text-white" : "text-[#8a7a72]"} />
              </span>
              <span className={cn("text-[11px] transition-colors", active ? "font-semibold text-[#d13f1f]" : "font-medium text-[#8a7a72]")}>
                {item.label}
              </span>
              <NavigationPendingIndicator className="rounded-none" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showBottomNav = !HIDE_BOTTOM_NAV_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const showFab = !HIDE_FAB_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <>
      <CustomerTopbar pathname={pathname} />
      <ActiveServiceBanner />
      <div className="customer-app">{children}</div>
      <footer className={cn("border-t border-[#7c4a3a] bg-gradient-to-br from-[#2b1815] via-[#3d2018] to-[#5c2718] px-4 py-4 text-center text-[11px] font-medium leading-5 text-[#f7e9e3]", showBottomNav && "mb-[calc(68px+env(safe-area-inset-bottom))] md:mb-0")}>
        <p className="text-xs font-bold tracking-wide text-white">Tâm An Care</p>
        <div className="mt-0.5 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/dieu-khoan" className="transition-colors hover:text-[#f5d982]">Điều khoản</Link>
          <Link href="/chinh-sach-rieng-tu" className="transition-colors hover:text-[#f5d982]">Bảo vệ dữ liệu</Link>
          <Link href="/chinh-sach-dat-lich" className="transition-colors hover:text-[#f5d982]">Đặt lịch & đặt cọc</Link>
        </div>
      </footer>
      {showBottomNav ? <CustomerBottomNav pathname={pathname} /> : null}
      {showFab ? <BookingFab /> : null}
    </>
  );
}
