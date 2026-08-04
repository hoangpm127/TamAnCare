import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Clock,
  Gem,
  Gift,
  MapPin,
  PackagePlus,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getPublicCatalog } from "@/lib/server/public-catalog";
import { formatMoney, stripDurationFromName } from "@/lib/utils";
import { VoucherCard } from "@/components/voucher-card";
import { TherapistAvatar } from "@/components/therapist-avatar";
import { BookingHeroCta } from "@/components/booking-fab";
import { BrandWordmark } from "@/components/brand-wordmark";
import { GoogleMapEmbed } from "@/components/google-map-embed";

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; tone: string }[] = [
  { href: "/don-cua-toi?tab=upcoming", label: "Lịch đã đặt", icon: CalendarClock, tone: "bg-[#fae9e4] text-[#c64b32] ring-[#c64b32]/10" },
  { href: "/don-cua-toi?tab=history", label: "Lịch sử", icon: Receipt, tone: "bg-[#fbf2e7] text-[#76551d] ring-[#76551d]/10" },
  { href: "/uu-dai", label: "Ưu đãi", icon: Gift, tone: "bg-[#fbf1d8] text-[#76551d] ring-[#c59a3d]/15" },
  { href: "/ru-ban", label: "Affiliate", icon: BadgePercent, tone: "bg-[#f8ebe5] text-[#7c2927] ring-[#7c2927]/10" },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await getPublicCatalog();
  const account = await getCustomerSession();
  const { branches, packagePlans, services, therapists, vouchers } = catalog;
  const featuredServices = services.filter((service) => service.popular).slice(0, 3);
  const firstVisitEligible = !account || account.customer.totalVisits === 0;
  const featuredVouchers = vouchers.filter((voucher) => firstVisitEligible || voucher.code !== "FIRST60").slice(0, 3);
  const featuredTherapists = therapists
    .filter((therapist) => therapist.status === "ACTIVE")
    .sort((a, b) => b.ratingAvg - a.ratingAvg);
  const activeTherapistCount = therapists.filter((therapist) => therapist.status === "ACTIVE").length;
  const bestPackage = packagePlans.find((plan) => plan.id === "pkg-body-15") ?? packagePlans[0];

  return (
    <main className="bg-[#fdf8f3] text-[#281b18]">
      <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-10">
        <div className="relative min-h-[300px] overflow-hidden rounded-2xl bg-[#1b1110] text-white shadow-xl shadow-black/20 ring-1 ring-[#c59a3d]/25 sm:min-h-[340px]">
          <Image
            src="/tam-an-hero.png"
            alt="Phòng massage Tâm An sạch sẽ với giường đã chuẩn bị sẵn"
            fill
            className="object-cover opacity-90"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#170b0a]/92 via-[#170b0a]/45 to-transparent" />
          <div className="relative z-10 flex min-h-[300px] flex-col items-center justify-end px-4 py-5 text-center sm:min-h-[340px] sm:px-6 sm:py-6">
            <Image src="/tam-an-center-mark-transparent.png" alt="" width={66} height={66} className="mb-2 h-[66px] w-[66px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.34)]" />
            <p className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium">
              <Sparkles size={12} /> Chăm sóc chỉn chu · đặt lịch minh bạch
            </p>
            <h1 className="max-w-md text-xl font-semibold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
              <BrandWordmark className="mx-auto mb-1 h-[29px] w-[220px] text-[#e8cf8a] sm:h-[35px] sm:w-[270px]" />
              <span className="block">GIÚP BẠN VUI KHỎE MỖI NGÀY</span>
            </h1>
            <p className="mt-2 max-w-md text-xs leading-5 text-white/80 sm:text-sm">
              Đặt trước massage Body, cổ vai gáy, chân, lưng hông và các liệu trình chăm sóc chuyên sâu trong dưới 60 giây.
            </p>
            <BookingHeroCta />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/15 pt-3 text-[11px] text-white/85 sm:text-xs">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                <strong className="font-semibold text-white">{branches.length}</strong> cơ sở đang nhận lịch
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {activeTherapistCount} KTV chuyên nghiệp
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} /> Đào tạo & tái kiểm định định kỳ
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-10">
        <Link href="/tai-khoan" className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8cf8a]/30 bg-gradient-to-r from-[#7c2927] via-[#a64032] to-[#c85a38] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(76,25,27,0.16)]">
          <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8cf8a] text-[#7c2927]"><Gift size={19} /></span>
            <span className="min-w-0"><strong className="block text-sm">Tạo tài khoản nhận ưu đãi 100K</strong><small className="mt-0.5 block text-[11px] text-white/70">Đặt lịch không cần đăng nhập · đăng ký để giữ quyền lợi riêng</small></span>
          </span>
          <ArrowRight className="shrink-0 text-[#e7c878]" size={18} />
        </Link>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-10">
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-[#e7d6ca] bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, tone }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-xl py-1 text-center transition hover:bg-[#fcf3ed]">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${tone}`}>
                <Icon size={20} />
              </span>
              <span className="text-[11px] font-medium leading-tight text-[#51423b] sm:text-xs">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-3 pt-4 sm:px-6 lg:px-10">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Ưu đãi dành cho bạn</h2>
          <Link href="/uu-dai" className="hidden font-semibold text-[#c64b32] sm:inline-flex">
            Xem tất cả
          </Link>
        </div>
        <div className="scrollbar-hide flex snap-x gap-3 overflow-x-auto sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
          {featuredVouchers.map((voucher, index) => (
            <VoucherCard key={voucher.code} voucher={voucher} showAllLink={index === 2} className="w-64 snap-start sm:w-auto" />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 pt-3 sm:px-6 lg:px-10">
        <div className="mb-2.5">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Ưu điểm tại Tâm An Center</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {[
            { title: "Giá rõ ràng", body: "Hiển thị đúng giá dịch vụ trước khi đặt, không phát sinh.", accent: "#c64b32" },
            { title: "Chọn KTV", body: "Chọn KTV yêu thích hoặc để hệ thống gợi ý người còn slot.", accent: "#76551d" },
            { title: "Không trùng lịch", body: "Kiểm tra KTV và phòng/giường với buffer 15 phút.", accent: "#9f7428" },
            { title: "Không làm phiền", body: "Chỉ nhắc lịch đúng lúc theo cài đặt của bạn, không gọi quảng cáo.", accent: "#7c2927" },
          ].map(({ title, body, accent }) => (
            <div
              key={title}
              className="flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-[#fffdf9] to-[#fbf3e8] text-[#281b18] shadow-[0_8px_22px_rgba(76,25,27,0.07)] transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: `${accent}30` }}
            >
              <div className="border-b px-3.5 py-2.5" style={{ backgroundColor: `${accent}10`, borderColor: `${accent}20` }}>
                <h3 className="truncate text-sm font-semibold tracking-tight" style={{ color: accent }}>
                  {title}
                </h3>
              </div>
              <p className="px-3.5 py-3 text-xs leading-5 text-[#68574f]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-10">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Chọn nhanh gói phù hợp</h2>
          <Link href="/booking" className="hidden font-semibold text-[#c64b32] sm:inline-flex">
            Xem lịch trống
          </Link>
        </div>
        <div className="scrollbar-hide flex snap-x gap-3 overflow-x-auto sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
          {featuredServices.map((service) => (
            <Link
              key={service.id}
              href={`/booking?service=${service.id}`}
              className="w-40 shrink-0 snap-start rounded-xl border border-[#e7d6ca] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
            >
              <div className="inline-flex items-center gap-1 rounded-full bg-[#fae9e4] px-2.5 py-1 text-[11px] font-semibold text-[#c64b32]">
                <Clock size={11} /> {service.durationMin} phút
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight tracking-tight">{stripDurationFromName(service.name)}</h3>
              <p className="mt-2 text-sm font-semibold">{formatMoney(service.basePrice + service.therapistFee)}</p>
            </Link>
          ))}
        </div>
      </section>

      {bestPackage ? <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Link
          href="/uu-dai"
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-[#c59a3d]/45 bg-gradient-to-r from-[#4c191b] via-[#7c2927] to-[#b85336] p-4 text-white shadow-[0_10px_26px_rgba(76,25,27,0.17)] transition hover:opacity-95 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#e7c878]/30 bg-[#4c191b]/30">
            <Gem size={22} className="text-[#e7c878]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-[#e7c878]">
              <PackagePlus size={13} className="shrink-0" /> Gói dài hạn nổi bật
            </span>
            <span className="mt-0.5 block text-sm font-semibold leading-5 tracking-tight sm:text-base">{bestPackage.name}</span>
            <span className="block text-[11px] leading-4 text-white/75 sm:text-xs">
              {bestPackage.badge} · chỉ {formatMoney(Math.round(bestPackage.price / (bestPackage.paidSessions + bestPackage.bonusSessions)))}/buổi
            </span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-[#e7c878]" />
        </Link>
      </section> : null}

      <section className="mx-auto max-w-7xl px-4 pb-3 pt-4 sm:px-6 lg:px-10">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Đội ngũ KTV tại Tâm An Center</h2>
          <Link href="/ktv" className="hidden font-semibold text-[#c64b32] sm:inline-flex">
            Xem hồ sơ KTV
          </Link>
        </div>
        <div className="scrollbar-hide flex snap-x gap-3 overflow-x-auto sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible">
          {featuredTherapists.map((therapist) => (
            <Link
              key={therapist.id}
              href={`/ktv/${therapist.id}`}
              className="w-40 shrink-0 snap-start rounded-xl border border-[#e7d6ca] bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
            >
              <TherapistAvatar id={therapist.id} src={therapist.avatarUrl} size={56} className="mx-auto shrink-0 rounded-full" />
              <p className="mt-3 text-sm font-semibold tracking-tight">{therapist.fullName}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-[#826f66]">
                {therapist.servedCount > 0 ? (
                  <><Star size={12} className="fill-[#c64b32] text-[#c64b32]" /> {therapist.ratingAvg.toFixed(1)} · {therapist.servedCount} buổi</>
                ) : <span className="font-semibold text-[#a85f29]">KTV mới</span>}
              </p>
              <p className="mt-2 line-clamp-1 text-[11px] text-[#826f66]">{(therapist.publicStrengths.length ? therapist.publicStrengths : therapist.skills).join(" · ")}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl border border-[#e8c45f]/45 bg-gradient-to-br from-[#680d13] via-[#8f1719] to-[#bd3b21] text-white shadow-xl">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#e3b23c]/15 blur-3xl" />
          <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div className="text-center">
              <span className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[#c59a3d]/35 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#e7c878]">
                <Briefcase size={13} /> Tâm An Business
              </span>
              <h2 className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">Tăng cường sức khỏe vào Buổi Trưa ngay tại Văn Phòng</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/75">
                KTV đến tận nơi vào giờ nghỉ trưa, điều phối theo đầu người và xuất báo cáo rõ ràng cho HR. Doanh nghiệp có thể bắt đầu
                bằng một buổi trải nghiệm rồi nâng cấp gói tháng.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { value: "15–30'", label: "mỗi nhân sự" },
                  { value: "75K", label: "giá từ" },
                  { value: "8–30", label: "người/buổi" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.07] px-2 py-3 text-center">
                    <p className="text-base font-bold text-[#e7c878]">{item.value}</p>
                    <p className="mt-0.5 text-[10px] text-white/60">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#e7c878]">Quy trình triển khai</p>
              <div className="mt-3 space-y-3">
                {[
                  "Chọn quy mô, khung giờ và gói trải nghiệm",
                  "Hệ thống tính số KTV, chi phí và tiền cọc",
                  "Tâm An xác nhận, phục vụ và báo cáo cho HR",
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7c878] text-[11px] font-bold text-[#741016]">{index + 1}</span>
                    <p className="pt-0.5 text-xs leading-5 text-white/80">{item}</p>
                  </div>
                ))}
              </div>
              <Link href="/doanh-nghiep" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-[#8c332a] shadow-sm">
                Đặt lịch trải nghiệm ngay <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 pt-2 sm:px-6 lg:px-10">
        <div className="overflow-hidden rounded-2xl border border-[#c59a3d]/35 bg-gradient-to-br from-[#fffdf9] via-[#fbf3e8] to-[#fbf2e7] text-[#281b18] shadow-[0_12px_30px_rgba(76,25,27,0.08)]">
          <div className="px-5 pt-5 sm:px-7 sm:pt-7">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#76551d]">
              <ShieldCheck size={13} /> Vận hành minh bạch
            </p>
          </div>
          <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#7c2927]">
                <ShieldCheck size={15} /> Cam kết vận hành
              </p>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-[#68574f]">
                <li>• Không quảng cáo ảo, không nội dung nhạy cảm</li>
                <li>• Mọi booking được theo dõi minh bạch qua hệ thống</li>
                <li>• Khách quay lại luôn được chăm sóc lại tự động</li>
              </ul>
            </div>
            <div className="space-y-3.5 border-t border-[#e7d6ca] pt-4 text-xs md:border-t-0 md:border-l md:pl-5 md:pt-0">
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-[#76551d]">
                  <CalendarCheck size={13} /> Quy trình
                </p>
                <p className="mt-1 text-[#68574f]">Chọn dịch vụ → đặt lịch → đến đúng giờ.</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-[#76551d]">
                  <QrCode size={13} /> Voucher đang chạy
                </p>
                <p className="mt-1 text-[#68574f]">{vouchers.map((voucher) => voucher.code).join(" · ")}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-[#76551d]">
                  <MapPin size={13} /> Địa chỉ
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {branches.map((item) => (
                    <div key={item.id}>
                      <p className="text-[#68574f]">
                        <span className="font-semibold text-[#4c191b]">{item.label}:</span> {item.address}
                      </p>
                      <GoogleMapEmbed address={item.address} branchLabel={item.label} className="mt-3" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
