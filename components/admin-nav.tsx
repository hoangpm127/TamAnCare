"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BedDouble,
  Bell,
  BrainCircuit,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gem,
  Landmark,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Newspaper,
  ReceiptText,
  QrCode,
  Rocket,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { ADMIN_SECTION_GROUPS, ADMIN_SECTION_META } from "@/lib/admin-section-config";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/components/admin-session-provider";
import { useAdminBookingRequests } from "@/lib/admin-booking-store";
import { AdminCustomerFab, AdminExpenseAction } from "@/components/admin-quick-actions";
import { usePublicCatalog } from "@/lib/catalog-store";
import { NavigationPendingIndicator } from "@/components/navigation-pending-indicator";
import { NOTIFICATION_TONE_STYLES, presentNotification } from "@/lib/notification-presentation";

const PRIORITY_ITEMS = [
  { slug: "dashboard", label: "Tổng quan", icon: LayoutDashboard, href: "/admin" },
  { slug: "bookings", label: "Booking", icon: CalendarCheck, href: "/admin/bookings" },
  { slug: "calendar", label: "Lịch", icon: CalendarDays, href: "/admin/calendar" },
  { slug: "rooms", label: "Phòng", icon: BedDouble, href: "/admin/rooms" },
  { slug: "reports", label: "Báo cáo", icon: BarChart3, href: "/admin/reports" },
] as const;

type AdminNotificationFilter = "ALL" | "UNREAD" | "BOOKING" | "BRANCH" | "VIP" | "FINANCE";
type AdminNotificationItem = {
  id: string;
  href: string;
  title: string;
  body: string;
  kind: "booking" | "branch" | "vip" | "finance" | "staff" | "system";
  branchId: string;
  createdAt: string;
  read: boolean;
};

type InvestorNotificationFilter = "ALL" | "UNREAD" | "FINANCE" | "PROMOTION" | "SYSTEM";
type InvestorNavView = "overview" | "performance" | "opportunities" | "benefits" | "updates";
type InvestorNotificationItem = {
  id: string;
  type: "FINANCE" | "PROMOTION" | "SYSTEM";
  title: string;
  body: string;
  actionUrl: string | null;
  branchId: string | null;
  createdAt: string;
  read: boolean;
};

function notificationTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 2) return "Vừa cập nhật";
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

export function AdminNav() {
  const catalog = usePublicCatalog();
  const branches = catalog.branches;
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAdminSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<AdminNotificationFilter>("ALL");
  const [notificationBranch, setNotificationBranch] = useState("all");
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);
  const [investorNotifications, setInvestorNotifications] = useState<InvestorNotificationItem[]>([]);
  const [investorNotificationFilter, setInvestorNotificationFilter] = useState<InvestorNotificationFilter>("ALL");
  const [investorNotificationsLoading, setInvestorNotificationsLoading] = useState(true);
  const [investorActiveView, setInvestorActiveView] = useState<InvestorNavView>("overview");
  const [bookingCounts, setBookingCounts] = useState({ regular: 0, business: 0 });
  const bookingRequests = useAdminBookingRequests(session?.role !== "INVESTOR");

  useEffect(() => {
    if (!session || session.role === "INVESTOR") return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/admin-notifications", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải thông báo quản trị.");
        if (active) setAdminNotifications(payload.notifications as AdminNotificationItem[]);
      } catch {
        // Giữ snapshot DB gần nhất khi thiết bị tạm mất kết nối.
      }
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session]);

  useEffect(() => {
    if (!session || ["INVESTOR", "THERAPIST"].includes(session.role)) return;
    let active = true;
    async function loadCounts() {
      try {
        const response = await fetch("/api/admin-nav/booking-counts", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) return;
        if (active) setBookingCounts({ regular: Number(payload.regular ?? 0), business: Number(payload.business ?? 0) });
      } catch {
        // Giữ số gần nhất khi thiết bị tạm mất kết nối.
      }
    }
    void loadCounts();
    const timer = window.setInterval(loadCounts, 8_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session]);

  useEffect(() => {
    if (session?.role !== "INVESTOR") return;
    const syncView = () => {
      const requested = window.location.hash.replace(/^#+/, "").split("#")[0] as InvestorNavView;
      if (["overview", "performance", "opportunities", "benefits", "updates"].includes(requested)) setInvestorActiveView(requested);
    };
    queueMicrotask(syncView);
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, [session]);

  useEffect(() => {
    if (session?.role !== "INVESTOR") return;
    let active = true;
    fetch("/api/investor/notifications", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải thông báo.");
        return payload.notifications as InvestorNotificationItem[];
      })
      .then((items) => { if (active) setInvestorNotifications(items); })
      .catch(() => { if (active) setInvestorNotifications([]); })
      .finally(() => { if (active) setInvestorNotificationsLoading(false); });
    return () => { active = false; };
  }, [session]);

  if (!session) return null;

  if (session.role === "INVESTOR") {
    const unreadInvestorNotifications = investorNotifications.filter((item) => !item.read).length;
    const filteredInvestorNotifications = investorNotifications.filter((item) => {
      if (investorNotificationFilter === "UNREAD") return !item.read;
      if (investorNotificationFilter === "ALL") return true;
      return item.type === investorNotificationFilter;
    });
    const investorNavItems = [
      { view: "overview" as const, href: "/admin#overview", label: "Tổng quan", icon: LayoutDashboard, activeIconClass: "bg-[#d6b45e] text-[#2b1b13] shadow-[#d6b45e]/25", activeTextClass: "text-[#dfbf6c]" },
      { view: "performance" as const, href: "/admin#performance", label: "Hiệu quả", icon: BarChart3, activeIconClass: "bg-[#d2ad5d] text-[#281b18] shadow-emerald-300/20", activeTextClass: "text-emerald-200" },
      { view: "opportunities" as const, href: "/admin#opportunities", label: "Cơ hội mới", icon: Rocket, activeIconClass: "bg-[#78baff] text-[#10243a] shadow-sky-300/20", activeTextClass: "text-sky-200" },
      { view: "benefits" as const, href: "/admin#benefits", label: "Đặc quyền", icon: Gem, activeIconClass: "bg-[#d99be4] text-[#341b38] shadow-fuchsia-300/20", activeTextClass: "text-fuchsia-200" },
      { view: "updates" as const, href: "/admin#updates", label: "Cập nhật", icon: Newspaper, activeIconClass: "bg-[#9bc5e8] text-[#172838] shadow-sky-200/20", activeTextClass: "text-sky-100" },
    ];

    function markInvestorNotificationRead(id: string) {
      setInvestorNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
      void fetch("/api/investor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    }

    function markAllInvestorNotificationsRead() {
      setInvestorNotifications((items) => items.map((item) => ({ ...item, read: true })));
      void fetch("/api/investor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    }

    function selectInvestorView(view: InvestorNavView) {
      setInvestorActiveView(view);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${view}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.scrollTo({ top: 0, behavior: "auto" });
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }

    function openInvestorNotification(item: InvestorNotificationItem) {
      markInvestorNotificationRead(item.id);
      setNotificationsOpen(false);
      const requestedView = item.actionUrl?.split("#")[1] as InvestorNavView | undefined;
      if (requestedView && ["overview", "performance", "opportunities", "benefits", "updates"].includes(requestedView)) {
        selectInvestorView(requestedView);
        return;
      }
      if (item.actionUrl) router.push(item.actionUrl);
    }

    return (
      <>
        <header className="sticky top-0 z-40 border-b border-[#d6b45e]/15 bg-[#160f0e]/95 text-white shadow-xl shadow-black/15 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
            <button type="button" onClick={() => selectInvestorView("overview")} className="flex min-w-0 items-center gap-2.5 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d6b45e]/30 bg-[#d6b45e]/10 text-[#d6b45e]"><Landmark size={17} /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">Tâm An Investor</span><span className="block truncate text-[9px] text-[#d6b45e]/75">Báo cáo đầu tư · chỉ xem</span></span>
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-white/60 sm:inline-flex">{session.displayName}</span>
              <button type="button" onClick={() => setNotificationsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/65 transition hover:border-[#d6b45e]/35 hover:text-[#d6b45e]" aria-label="Mở thông báo nhà đầu tư">
                <Bell size={16} />
                {unreadInvestorNotifications > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c64b32] px-1 text-[9px] font-bold text-white ring-2 ring-[#160f0e]">{unreadInvestorNotifications}</span> : null}
              </button>
              <button type="button" onClick={() => void logout()} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 hover:border-[#d6b45e]/30 hover:text-[#d6b45e]" aria-label="Đăng xuất"><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d6b45e]/15 bg-[#160f0e]/96 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            {investorNavItems.map((item) => {
              const Icon = item.icon;
              const active = investorActiveView === item.view;
              return <button key={item.href} type="button" onClick={() => selectInvestorView(item.view)} className={cn("relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-white/38 transition", active && item.activeTextClass)}><span className={cn("relative flex h-8 w-10 items-center justify-center rounded-2xl transition-all duration-300", active && `-translate-y-1 shadow-lg ${item.activeIconClass}`)}><Icon size={active ? 18 : 17} strokeWidth={active ? 2.4 : 2} />{item.href.endsWith("opportunities") && investorNotifications.some((notification) => !notification.read && notification.actionUrl?.includes("opportunities")) ? <i className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[#160f0e]", active ? "bg-white" : "bg-sky-300")} /> : null}</span><span className={cn("whitespace-nowrap text-[8px] font-semibold transition", active && "font-bold")}>{item.label}</span></button>;
            })}
          </div>
        </nav>

        {notificationsOpen ? (
          <div className="fixed inset-0 z-50">
            <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNotificationsOpen(false)} aria-label="Đóng thông báo" />
            <section className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-[2rem] border-t border-[#d6b45e]/18 bg-[#1b1211] text-white shadow-2xl sm:bottom-auto sm:left-auto sm:right-6 sm:top-16 sm:h-auto sm:max-h-[86dvh] sm:w-[430px] sm:rounded-2xl sm:border">
              <div className="shrink-0 bg-gradient-to-br from-[#3c271f] via-[#271817] to-[#160f0e] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="flex items-center gap-1.5 text-sm font-semibold"><Bell size={16} className="text-[#e7c878]" /> Bản tin Nhà đầu tư</p><p className="mt-1 text-[10px] text-white/55">Hiệu quả đầu tư, cơ hội mới và quyền lợi dành cho bạn.</p></div>
                  <button type="button" onClick={() => setNotificationsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/65" aria-label="Đóng"><X size={17} /></button>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-white/7 bg-white/[0.045] px-3 py-2">
                  <span className="text-[10px] text-white/60"><strong className="text-sm text-[#e7c878]">{unreadInvestorNotifications}</strong> cập nhật mới</span>
                  <button type="button" onClick={markAllInvestorNotificationsRead} disabled={unreadInvestorNotifications === 0} className="inline-flex items-center gap-1 rounded-full bg-[#d6b45e] px-2.5 py-1.5 text-[10px] font-bold text-[#3a261a] disabled:opacity-40"><CheckCheck size={13} /> Đã xem tất cả</button>
                </div>
              </div>
              <div className="scrollbar-hide shrink-0 overflow-x-auto border-b border-white/7 bg-[#211615] p-3">
                <div className="flex gap-1.5">
                  {([[
                    "ALL", "Tất cả", Bell,
                  ], ["UNREAD", "Chưa xem", Check], ["FINANCE", "Cơ hội mới", Rocket], ["PROMOTION", "Đặc quyền", Gem], ["SYSTEM", "Cập nhật chung", Newspaper]] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setInvestorNotificationFilter(value)} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[9px] font-semibold", investorNotificationFilter === value ? "border-[#d6b45e] bg-[#d6b45e] text-[#382319]" : "border-white/9 text-white/48")}><Icon size={11} /> {label}</button>)}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-3">
                {investorNotificationsLoading ? <div className="rounded-2xl border border-white/7 p-8 text-center text-[10px] text-white/40">Đang cập nhật bản tin…</div> : null}
                {!investorNotificationsLoading && filteredInvestorNotifications.map((item) => {
                  const Icon = item.type === "FINANCE" ? Rocket : item.type === "PROMOTION" ? Gem : Newspaper;
                  const source = item.type === "FINANCE" ? "Đội ngũ đầu tư" : item.type === "PROMOTION" ? "Chăm sóc nhà đầu tư" : "Tâm An Center";
                  const presentation = presentNotification(item.title, item.body);
                  const tone = NOTIFICATION_TONE_STYLES[presentation.tone];
                  return <div key={item.id} className={cn("flex items-start gap-2 rounded-2xl border p-2.5", tone.darkCard, item.read && "opacity-70")}>
                    <button type="button" onClick={() => openInvestorNotification(item)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone.darkIcon)}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1"><span className="flex items-start gap-1"><strong className="min-w-0 flex-1 text-[11px] leading-4">{presentation.title}</strong>{!item.read ? <i className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", tone.dot)} /> : null}</span><span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-semibold", tone.darkBadge)}>{presentation.label}</span><span className="mt-1 block text-[10px] leading-4 text-white/55">{presentation.body}</span><span className="mt-1.5 block text-[9px] font-medium text-white/30">{source} · {notificationTime(item.createdAt)}</span></span>
                      <ChevronRight size={14} className="mt-3 shrink-0 text-[#d6b45e]/65" />
                    </button>
                    {!item.read ? <button type="button" onClick={() => markInvestorNotificationRead(item.id)} className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/6", tone.darkIcon)} aria-label="Đánh dấu đã xem"><Check size={13} /></button> : null}
                  </div>;
                })}
                {!investorNotificationsLoading && filteredInvestorNotifications.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-[10px] text-white/40">Không có bản tin phù hợp bộ lọc.</div> : null}
              </div>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  const allowedSections = session.permissions.filter((slug) => canAccessAdminSection(session, slug));
  const canManageFinance = ["OWNER", "BRANCH_MANAGER"].includes(session.role);
  const priorityItems = PRIORITY_ITEMS.filter((item) => item.slug === "dashboard" || canAccessAdminSection(session, item.slug));
  const primaryMobileItems = priorityItems.slice(0, 4);
  const moreActive = pathname.startsWith("/admin/") && !pathname.startsWith("/admin/finance") && !primaryMobileItems.some((item) => item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href));
  const scopedPendingBookings = bookingRequests.filter((item) => item.status === "NEW" && (session.role === "OWNER" || item.branchId === session.branchId));
  const regularBookingCount = Math.max(bookingCounts.regular, scopedPendingBookings.length);
  const isNotificationUnread = (item: AdminNotificationItem) => !item.read;
  const unreadNotificationCount = adminNotifications.filter(isNotificationUnread).length;
  const filteredAdminNotifications = adminNotifications.filter((item) => {
    if (notificationBranch !== "all" && item.branchId !== notificationBranch) return false;
    if (notificationFilter === "UNREAD") return isNotificationUnread(item);
    if (notificationFilter === "BOOKING") return item.kind === "booking";
    if (notificationFilter === "BRANCH") return ["branch", "staff", "system"].includes(item.kind);
    if (notificationFilter === "VIP") return item.kind === "vip";
    if (notificationFilter === "FINANCE") return item.kind === "finance" || item.kind === "system";
    return true;
  });
  function markNotificationRead(id: string) {
    setAdminNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
    void fetch("/api/admin-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  function markAllAdminNotificationsRead() {
    setAdminNotifications((items) => items.map((item) => ({ ...item, read: true })));
    void fetch("/api/admin-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  async function logout() {
    await signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#e7d6ca] bg-white/95 shadow-[0_1px_12px_rgba(159,29,32,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          <Link href="/admin" className="tap-feedback relative flex min-w-0 items-center gap-2.5 rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-64.png" alt="" className="h-9 w-9 shrink-0 rounded-full" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Tâm An Operations</span>
              <span className="block truncate text-[10px] font-medium text-[#c64b32]">{session.branchLabel}</span>
            </span>
            <NavigationPendingIndicator />
          </Link>

          <div className="flex items-center gap-1.5">
            <AdminExpenseAction />

            {session.role === "OWNER" ? <Link href="/admin/investment-opportunities" className={cn("tap-feedback relative flex h-9 w-9 items-center justify-center rounded-full border", pathname.startsWith("/admin/investment-opportunities") ? "border-[#76551d] bg-[#76551d] text-white" : "border-[#e7d6ca] text-[#76551d]")} aria-label="Quản lý cơ hội đầu tư" title="Cơ hội đầu tư"><Rocket size={17} /><NavigationPendingIndicator /></Link> : null}
            {canManageFinance ? <Link href="/admin/finance" className={cn("tap-feedback relative flex h-9 w-9 items-center justify-center rounded-full border", pathname.startsWith("/admin/finance") ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#7a3e1d]")} aria-label="Trung tâm Bill và tài chính" title="Bill & tài chính">
              <CircleDollarSign size={18} />
              <NavigationPendingIndicator />
            </Link> : null}
            <div className="relative hidden sm:block">
              <button type="button" onClick={() => setRoleOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-[#e7d6ca] bg-[#fdf8f3] py-1.5 pl-2 pr-3 text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c64b32] text-white">
                  {session.role === "OWNER" ? <ShieldCheck size={14} /> : <Building2 size={14} />}
                </span>
                <span>
                  <span className="block text-[11px] font-semibold leading-3.5">{session.displayName}</span>
                  <span className="block text-[9px] text-[#826f66]">{session.title}</span>
                </span>
                <ChevronDown size={13} className={cn("text-[#826f66] transition", roleOpen && "rotate-180")} />
              </button>
              {roleOpen ? (
                <div className="absolute right-0 top-12 w-64 rounded-2xl border border-[#e7d6ca] bg-white p-2 shadow-xl">
                  <div className="rounded-xl bg-[#fbf2e7] px-3 py-2">
                    <p className="text-xs font-semibold text-[#5c3a1e]">Phạm vi: {session.branchLabel}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#826f66]">{session.permissions.length} nhóm quyền đang được cấp</p>
                  </div>
                  <Link href="/dang-nhap-quan-tri" className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-[#fcf3ed]">
                    <ShieldCheck size={14} /> Đổi vai trò đăng nhập
                  </Link>
                  {session.role === "OWNER" || session.role === "BRANCH_MANAGER" ? <Link href="/bao-mat-quan-tri" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-[#fcf3ed]"><KeyRound size={14} /> Bảo mật hai lớp</Link> : null}
                  {session.role === "OWNER" ? <Link href="/admin/investment-opportunities" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium hover:bg-[#edf7fc]"><Rocket size={14} /> Hồ sơ cơ hội đầu tư</Link> : null}
                  <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#c64b32] hover:bg-[#f8ebe5]">
                    <LogOut size={14} /> Đăng xuất về trang chủ
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => setNotificationsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#e7d6ca] text-[#7a3e1d]" aria-label="Mở thông báo quản trị">
              <Bell size={17} />
              {unreadNotificationCount > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c64b32] px-1 text-[9px] font-bold text-white">{unreadNotificationCount}</span> : null}
            </button>
          </div>
        </div>

        <nav className="scrollbar-hide mx-auto hidden max-w-7xl gap-2 overflow-x-auto px-4 pb-2.5 sm:px-6 md:flex lg:px-10">
          <Link href="/admin" className={cn("tap-feedback relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", pathname === "/admin" ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#51423b]")}>Tổng quan<NavigationPendingIndicator light={pathname === "/admin"} /></Link>
          {allowedSections.map((slug) => {
            const meta = ADMIN_SECTION_META[slug];
            const Icon = meta.icon;
            return (
              <Link key={slug} href={`/admin/${slug}`} className={cn("tap-feedback relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", pathname.startsWith(`/admin/${slug}`) ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#51423b] hover:border-[#c64b32] hover:text-[#c64b32]")}>
                <Icon size={13} /> {meta.label}<NavigationPendingIndicator light={pathname.startsWith(`/admin/${slug}`)} />
              </Link>
            );
          })}
        </nav>
      </header>

      <AdminCustomerFab />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7d6ca] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {primaryMobileItems.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.slug} href={item.href} className="tap-feedback relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5">
                <span className={cn("relative flex h-8 w-8 items-center justify-center rounded-full", active && "bg-[#c64b32]")}>
                  <Icon size={18} className={active ? "text-white" : "text-[#826f66]"} />
                  {item.slug === "bookings" && regularBookingCount > 0 ? <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c59a3d] px-1 text-[9px] font-bold text-[#3d1f12] ring-2 ring-white">{regularBookingCount}</span> : null}
                  {item.slug === "bookings" && bookingCounts.business > 0 ? <span className="absolute -left-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a85f29] px-1 text-[9px] font-bold text-white ring-2 ring-white">{bookingCounts.business}</span> : null}
                </span>
                <span className={cn("text-[10px] font-medium", active ? "text-[#c64b32]" : "text-[#826f66]")}>{item.label}</span>
                <NavigationPendingIndicator className="rounded-none" />
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className="tap-feedback flex flex-1 flex-col items-center justify-center gap-1 py-2.5">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", moreActive && "bg-[#c64b32]")}><BrainCircuit size={18} className={moreActive ? "text-white" : "text-[#826f66]"} /></span>
            <span className={cn("text-[10px] font-medium", moreActive ? "text-[#c64b32]" : "text-[#826f66]")}>IQ Care</span>
          </button>
        </div>
      </nav>

      {notificationsOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fdf8f3] text-[#281b18]">
          <header className="sticky top-0 z-10 border-b border-[#e7d6ca] bg-white/95 shadow-[0_1px_12px_rgba(159,29,32,0.06)] backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-1.5"><button type="button" onClick={() => setNotificationsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#281b18] hover:bg-[#f8ebe5]" aria-label="Quay lại"><ChevronLeft size={20} /></button><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><Bell size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">Cập nhật vận hành</p><p className="truncate text-[9px] font-medium text-[#c64b32]">{session.branchLabel}</p></div></div>
              <button type="button" onClick={() => setNotificationsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]" aria-label="Đóng"><X size={17} /></button>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">
            <div className="mb-4 flex items-center gap-2"><Bell className="text-[#c64b32]" size={20} /><div><h1 className="text-xl font-semibold tracking-tight">Việc cần theo dõi</h1><p className="mt-0.5 text-[10px] text-[#826f66]">Lịch hẹn, thanh toán và chăm sóc khách hàng.</p></div></div>

            <section className="rounded-2xl border border-[#e7d6ca] bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold">Cập nhật công việc</p><p className="mt-0.5 text-[10px] text-[#826f66]">{unreadNotificationCount} việc mới cần xem</p></div>
                <button type="button" onClick={markAllAdminNotificationsRead} disabled={unreadNotificationCount === 0} className="inline-flex items-center gap-1.5 rounded-full bg-[#f8ebe5] px-3 py-2 text-[11px] font-semibold text-[#c64b32] disabled:opacity-45"><CheckCheck size={14} /> Đã xem tất cả</button>
              </div>
              <div className="scrollbar-hide -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 py-1">
                {([
                  ["ALL", "Tất cả", Bell], ["UNREAD", "Chưa xem", Check], ["BOOKING", "Lịch hẹn", CalendarCheck], ["BRANCH", "Cơ sở", Building2], ["VIP", "Khách hàng", Crown], ["FINANCE", "Tài chính", ReceiptText],
                ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setNotificationFilter(value)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold", notificationFilter === value ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] text-[#68574f]")}><Icon size={13} /> {label}</button>)}
              </div>
              {session.role === "OWNER" ? <div className="scrollbar-hide -mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 py-1">{[{ id: "all", label: "Toàn hệ thống" }, ...branches.map((item) => ({ id: item.id, label: item.label })), { id: "system", label: "Chi hệ thống" }].map((item) => <button key={item.id} type="button" onClick={() => setNotificationBranch(item.id)} className={cn("shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold", notificationBranch === item.id ? "border-[#dca9a2] bg-[#fae9e4] text-[#c64b32] shadow-sm shadow-[#c64b32]/8" : "border-transparent bg-[#f5f0ec] text-[#786962]")}>{item.label}</button>)}</div> : null}
            </section>

            <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm">
              {filteredAdminNotifications.map((item) => {
                const unread = isNotificationUnread(item);
                const Icon = item.kind === "booking" ? CalendarCheck : item.kind === "vip" ? Crown : item.kind === "finance" ? ReceiptText : item.kind === "branch" ? Building2 : item.kind === "system" ? Sparkles : UsersRound;
                const presentation = presentNotification(item.title, item.body);
                const tone = NOTIFICATION_TONE_STYLES[presentation.tone];
                return <article key={item.id} className={cn("flex gap-3 border-b border-l-4 px-4 py-3 last:border-b-0", tone.card, item.read && "bg-white/70")}>
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.icon)}><Icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} onClick={() => { markNotificationRead(item.id); setNotificationsOpen(false); }} className="block">
                      <div className="flex items-start gap-1.5"><p className="min-w-0 flex-1 text-sm font-semibold leading-5">{presentation.title}</p>{unread ? <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone.dot)} /> : null}<ChevronRight size={14} className={cn("mt-1 shrink-0", tone.action)} /></div>
                      <span className={cn("mt-1.5 inline-flex rounded-full px-2 py-1 text-[9px] font-semibold", tone.badge)}>{presentation.label}</span>
                      <p className="mt-1 text-xs leading-5 text-[#68574f]">{presentation.body}</p>
                    </Link>
                    <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] text-[#826f66]">{item.branchId === "system" ? "Toàn hệ thống" : branches.find((branch) => branch.id === item.branchId)?.label} · {notificationTime(item.createdAt)}</p>{unread ? <button type="button" onClick={() => markNotificationRead(item.id)} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-current px-2 py-1 text-[10px] font-semibold", tone.action)}><Check size={11} /> Đã xem</button> : <span className="inline-flex items-center gap-1 text-[10px] text-[#826f66]"><CheckCheck size={11} /> Đã xem</span>}</div>
                  </div>
                </article>;
              })}
              {filteredAdminNotifications.length === 0 ? <div className="p-10 text-center text-xs text-[#826f66]">Chưa có việc nào trong nhóm này.</div> : null}
            </div>
          </main>
        </div>
      ) : null}

      {moreOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fdf8f3] md:hidden">
          <div className="min-h-dvh p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
            <div className="relative mb-4 flex flex-col items-center rounded-2xl bg-gradient-to-br from-[#351b15] via-[#5c2718] to-[#8c211d] p-4 text-center text-white shadow-lg">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-[#e7c878] ring-1 ring-white/20">{session.role === "OWNER" ? <ShieldCheck size={18} /> : <Building2 size={18} />}</span>
                <div className="mt-2"><p className="text-base font-semibold">Trung tâm quản trị</p><p className="mt-0.5 text-[10px] text-white/70">{session.displayName} · {session.branchLabel}</p></div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Đóng"><X size={18} /></button>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#826f66]">Chức năng được cấp</p>
            <Link href="/admin" onClick={() => setMoreOpen(false)} className={cn("mb-3 flex items-center gap-2.5 rounded-xl border p-2.5", pathname === "/admin" ? "border-[#c64b32] bg-[#f8ebe5] text-[#c64b32]" : "border-[#e7d6ca] text-[#51423b]")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c64b32] text-white"><LayoutDashboard size={17} /></span>
              <span><span className="block text-xs font-semibold">Tổng quan vận hành</span><span className="block text-[10px] text-[#826f66]">KPI, lịch và cảnh báo hôm nay</span></span>
            </Link>
            <div className="space-y-3">
              {ADMIN_SECTION_GROUPS.map((group) => {
                const groupSections = group.sections.filter((slug) => allowedSections.includes(slug));
                if (groupSections.length === 0) return null;
                return (
                  <section key={group.label}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c64b32]">{group.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {groupSections.map((slug) => {
                        const meta = ADMIN_SECTION_META[slug];
                        const Icon = meta.icon;
                        return (
                          <Link key={slug} href={`/admin/${slug}`} onClick={() => setMoreOpen(false)} className={cn("flex min-w-0 items-center gap-2 rounded-xl border p-2.5", pathname.startsWith(`/admin/${slug}`) ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white")}>
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", pathname.startsWith(`/admin/${slug}`) ? "bg-[#c64b32] text-white" : "bg-[#fbf2e7] text-[#7a3e1d]")}><Icon size={15} /></span>
                            <span className="min-w-0"><span className="block truncate text-[11px] font-semibold">{meta.label}</span><span className="block truncate text-[9px] text-[#826f66]">{meta.shortDescription}</span></span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            {session.role === "OWNER" ? <Link href="/admin/investment-opportunities" onClick={() => setMoreOpen(false)} className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#c9dfe6] bg-[#f4fbfd] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#76551d] text-white"><Rocket size={16} /></span><span><span className="block text-xs font-semibold">Cơ hội đầu tư</span><span className="block text-[10px] text-[#6c7c84]">Tạo, thẩm định, công bố và gửi bản tin</span></span></Link> : null}
            {session.role === "OWNER" || session.role === "BRANCH_MANAGER" ? <Link href="/admin/qr-management" onClick={() => setMoreOpen(false)} className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#e8d2c4] bg-[#fbf2e7] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#76551d] text-white"><QrCode size={16} /></span><span><span className="block text-xs font-semibold">QR Tâm An Business</span><span className="block text-[10px] text-[#607a6b]">Chỉ dùng cho chương trình tại doanh nghiệp</span></span></Link> : null}
            {session.role === "OWNER" || session.role === "BRANCH_MANAGER" ? <Link href="/bao-mat-quan-tri" onClick={() => setMoreOpen(false)} className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#e7d6ca] bg-white p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><KeyRound size={16} /></span><span><span className="block text-xs font-semibold">Bảo mật hai lớp</span><span className="block text-[10px] text-[#826f66]">Authenticator và mã khôi phục</span></span></Link> : null}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e7d6ca] pt-4">
              <Link href="/dang-nhap-quan-tri" className="flex items-center justify-center gap-1.5 rounded-full border border-[#c64b32] px-3 py-2.5 text-xs font-semibold text-[#c64b32]"><ShieldCheck size={14} /> Đổi vai trò</Link>
              <button type="button" onClick={() => void logout()} className="flex items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-3 py-2.5 text-xs font-semibold text-white"><LogOut size={14} /> Đăng xuất</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
