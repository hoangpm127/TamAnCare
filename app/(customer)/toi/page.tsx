import Link from "next/link";
import { connection } from "next/server";
import {
  CalendarClock,
  ChevronRight,
  Gift,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MembershipSummaryCard } from "@/components/membership-summary-card";
import { MembershipUsageHistory } from "@/components/membership-usage-history";
import { WalletTeaserCard } from "@/components/wallet-teaser-card";
import { NotificationMenuRow } from "@/components/notification-menu-row";
import { AccountProfileCard } from "@/components/account-profile-card";
import { AccountRoleMenu } from "@/components/account-role-menu";
import { appVersion } from "@/lib/server/app-version";

export const metadata = {
  title: "Tôi | Tâm An Care",
};

type MenuItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: number;
};

const ACTIVITY_ITEMS: MenuItem[] = [
  { href: "/don-cua-toi?tab=upcoming", label: "Lịch đã đặt", description: "Lịch hẹn sắp tới", icon: CalendarClock },
  { href: "/don-cua-toi?tab=history", label: "Lịch sử & hoá đơn", description: "Buổi đã xong, tổng chi tiêu", icon: Receipt },
  { href: "/check-in", label: "Check-in tại cơ sở", description: "Quét mã QR tại quầy để bắt đầu dịch vụ", icon: QrCode },
];

const SUPPORT_ITEMS: MenuItem[] = [
  { href: "/uu-dai", label: "Ưu đãi của tôi", description: "Mã giảm giá đang có", icon: Gift },
  { href: "/ru-ban", label: "Rủ bạn bè nhận quà", description: "Mời bạn, cả hai cùng nhận quà", icon: Users },
  { href: "/chat", label: "Chat với cơ sở", description: "Nhắn tin với lễ tân", icon: MessageCircle },
  { href: "/lien-he", label: "Liên hệ Tâm An", description: "Hotline, địa chỉ, giờ mở cửa", icon: Phone },
];

function MenuRow({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 border-b border-[#f1e5dd] px-4 py-3 last:border-b-0 hover:bg-[#fff7f3]"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff2ef] text-[#d13f1f]">
        <Icon size={18} />
        {item.badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b51f24] px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {item.badge}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#191414]">{item.label}</span>
        <span className="block truncate text-xs text-[#8a7a72]">{item.description}</span>
      </span>
      <ChevronRight className="shrink-0 text-[#c9b6ac]" size={18} />
    </Link>
  );
}

export default async function AccountPage() {
  await connection();
  const version = appVersion();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <AccountProfileCard />

      <MembershipSummaryCard />
      <MembershipUsageHistory />

      <WalletTeaserCard />

      <p className="mb-2.5 mt-5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7a72]">Hoạt động của tôi</p>
      <section className="overflow-hidden rounded-xl border border-[#eadbd1] bg-white shadow-sm">
        {ACTIVITY_ITEMS.map((item) => (
          <MenuRow key={item.href} item={item} />
        ))}
        <NotificationMenuRow />
      </section>

      <p className="mb-2.5 mt-5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7a72]">Ưu đãi & hỗ trợ</p>
      <section className="overflow-hidden rounded-xl border border-[#eadbd1] bg-white shadow-sm">
        {SUPPORT_ITEMS.map((item) => (
          <MenuRow key={item.href} item={item} />
        ))}
      </section>

      <p className="mb-2.5 mt-5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7a72]">Tài khoản & quyền truy cập</p>
      <section className="overflow-hidden rounded-xl border border-[#eadbd1] bg-white shadow-sm">
        <AccountRoleMenu />
      </section>

      <p aria-label="Phiên bản ứng dụng" className="mt-6 text-center text-[10px] text-[#9a8d86]">
        Phiên bản <code className="font-mono">{version}</code>
      </p>
    </main>
  );
}
