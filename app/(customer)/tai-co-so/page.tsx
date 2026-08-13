import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, MapPin, ShieldCheck, UserRoundPlus } from "lucide-react";
import { VENUE_DIRECT_SOURCE } from "@/lib/customer-source";
import { getCustomerSession } from "@/lib/server/customer-session";

export const metadata: Metadata = {
  title: "Khách trực tiếp tại cơ sở | TÂM AN CENTER",
  description: "Trang chính thức dành cho khách sử dụng dịch vụ trực tiếp tại TÂM AN CENTER.",
};

const bookingPath = `/booking?source=${VENUE_DIRECT_SOURCE}`;
const accountPath = `/tai-khoan?source=${VENUE_DIRECT_SOURCE}&returnTo=${encodeURIComponent(bookingPath)}`;

export default async function VenueDirectPage() {
  const session = await getCustomerSession();

  return (
    <main className="min-h-[calc(100vh-7rem)] bg-[#fdf8f3] px-4 py-5 text-[#281b18] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-xl overflow-hidden rounded-[1.75rem] border border-[#d2ad5d]/55 bg-white shadow-[0_18px_55px_rgba(95,31,26,0.12)]">
        <div className="bg-gradient-to-br from-[#771d20] via-[#a63428] to-[#d45a32] px-5 py-7 text-center text-white sm:px-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2cf78] text-[#6f211f] shadow-lg ring-1 ring-white/35">
            <MapPin size={24} />
          </span>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffe6b0]">Mã chính thức tại cơ sở</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Chào mừng bạn đến TÂM AN CENTER</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/85">
            Dành cho khách đến trực tiếp, không qua người giới thiệu. Bạn có thể tạo hồ sơ thành viên hoặc đặt lịch lần tiếp theo ngay trên điện thoại.
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              [BadgeCheck, "Đúng nguồn", "Ghi nhận khách trực tiếp tại cơ sở"],
              [ShieldCheck, "Không qua Affiliate", "QR này không tạo hoa hồng giới thiệu"],
              [CalendarDays, "Dùng lại dễ dàng", "Theo dõi và đặt lịch trên điện thoại"],
            ].map(([Icon, title, body]) => {
              const ItemIcon = Icon as typeof BadgeCheck;
              return (
                <div key={String(title)} className="rounded-2xl border border-[#eedbd0] bg-[#fffaf6] p-3 text-center">
                  <ItemIcon className="mx-auto text-[#b6342a]" size={19} />
                  <p className="mt-1.5 text-xs font-semibold">{String(title)}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#78645b]">{String(body)}</p>
                </div>
              );
            })}
          </div>

          {session ? (
            <div className="rounded-2xl border border-[#d2ad5d]/60 bg-[#fbf2e7] p-4 text-center">
              <p className="text-sm font-semibold">Xin chào, {session.customer.fullName}</p>
              <p className="mt-1 text-xs leading-5 text-[#78645b]">Tài khoản của bạn đã sẵn sàng. Hãy đặt lịch tiếp theo khi cần.</p>
              <Link href={bookingPath} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#b92f2a] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-red-900/15">
                Đặt lịch lần tiếp theo <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Link href={accountPath} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b92f2a] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-red-900/15">
                <UserRoundPlus size={17} /> Đăng ký / đăng nhập thành viên
              </Link>
              <Link href={bookingPath} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d9b684] bg-white px-5 py-3 text-sm font-semibold text-[#7b2a25]">
                Đặt lịch nhanh, chưa cần tài khoản <ArrowRight size={16} />
              </Link>
              <p className="px-3 text-center text-[10px] leading-4 text-[#826f66]">Tạo tài khoản giúp bạn lưu lịch, theo dõi đơn và sử dụng ưu đãi thành viên nếu đủ điều kiện.</p>
            </div>
          )}

          <div className="rounded-2xl bg-[#f6efeb] px-4 py-3 text-[10px] leading-5 text-[#68574f]">
            <strong className="text-[#6f211f]">Lưu ý:</strong> Đây không phải mã check-in. Khi đến cơ sở, bạn chỉ cần đọc họ tên và số điện thoại; lễ tân sẽ thực hiện các bước vận hành còn lại. Mã này không tạo hoặc thay thế một quan hệ giới thiệu hợp lệ đã được ghi nhận trước đó.
          </div>
        </div>
      </section>
    </main>
  );
}
