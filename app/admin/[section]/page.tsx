import { notFound } from "next/navigation";
import { adminSections } from "@/lib/demo-data";
import { bookingStatusLabel, resourceStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";
import { db } from "@/lib/db";
import { AdminSettingsCenter } from "@/components/admin-settings-center";
import { AdminSectionContent, type AdminTableRow } from "@/components/admin-section-content";
import { AdminBookingOperations } from "@/components/admin-booking-operations";
import { AdminCalendarOperations } from "@/components/admin-calendar-operations";
import { AdminCustomerTimeline } from "@/components/admin-customer-timeline";
import { AdminRoomOperations } from "@/components/admin-room-operations";
import { AdminTherapistOperations } from "@/components/admin-therapist-operations";
import { AdminServiceOperations } from "@/components/admin-service-operations";
import { AdminVoucherOperations } from "@/components/admin-voucher-operations";
import { AdminPackageOperations } from "@/components/admin-package-operations";
import { CustomerPackageManager } from "@/components/customer-package-manager";
import { AdminAffiliateCenter } from "@/components/admin-affiliate-center";
import { canAccessAdminSection, type AdminAccount } from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/server/admin-session";

type SectionSlug = keyof typeof adminSections;

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return Object.keys(adminSections).map((section) => ({ section }));
}

async function rowsFor(section: SectionSlug, session: AdminAccount): Promise<AdminTableRow[]> {
  const branchId = session.role === "OWNER" ? undefined : session.branchId ?? "__none__";
  switch (section) {
    case "affiliates":
      return [];
    case "bookings":
    case "calendar": {
      const bookings = await db.booking.findMany({
        where: branchId ? { branchId } : {},
        include: { customer: true, service: true },
        orderBy: { startTime: "desc" },
        take: 200,
      });
      return bookings.map((booking) => ({
        primary: booking.bookingCode,
        secondary: booking.customer.fullName,
        meta: booking.service.name,
        status: bookingStatusLabel(booking.status),
        value: formatMoney(booking.totalAmount),
        branchId: booking.branchId,
      }));
    }
    case "capacity":
    case "rooms": {
      const rooms = await db.room.findMany({ where: branchId ? { branchId } : {}, orderBy: [{ branchId: "asc" }, { name: "asc" }] });
      return rooms.map((room) => ({
        primary: room.name,
        secondary: room.type,
        meta: room.suitableCategories.join(", "),
        status: resourceStatusLabel(room.status),
        value: room.status === "ACTIVE" ? "Cho đặt" : "Tạm ẩn",
        branchId: room.branchId,
      }));
    }
    case "customers": {
      const customers = await db.customer.findMany({
        where: branchId ? { bookings: { some: { branchId } } } : {},
        include: { favoriteTherapist: true, bookings: { where: branchId ? { branchId } : {}, orderBy: { startTime: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 300,
      });
      return customers.map((customer) => ({
        primary: customer.fullName,
        secondary: customer.phone,
        meta: `${customer.totalVisits} lượt · ${customer.favoriteTherapist?.fullName ?? "Chưa chọn KTV"}`,
        status: resourceStatusLabel(customer.segment),
        value: formatMoney(customer.totalSpend),
        href: `/admin/customers/${customer.id}`,
        branchId: customer.bookings[0]?.branchId,
      }));
    }
    case "therapists": {
      const therapists = await db.therapist.findMany({ where: branchId ? { branchId } : {}, orderBy: [{ branchId: "asc" }, { fullName: "asc" }] });
      return therapists.map((therapist) => ({
        primary: therapist.fullName,
        secondary: therapist.skills.join(", "),
        meta: `${therapist.servedCount} lượt · ${therapist.repeatCount} khách đặt lại`,
        status: resourceStatusLabel(therapist.status),
        value: `${therapist.ratingAvg.toFixed(1)} sao`,
        href: `/admin/therapists/${therapist.id}`,
        branchId: therapist.branchId,
      }));
    }
    case "services": {
      const services = await db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
      return services.map((service) => ({
        primary: service.name,
        secondary: service.category,
        meta: `${service.durationMin} phút`,
        status: service.isActive && service.isOnline ? "Đang nhận lịch" : "Tạm ẩn",
        value: formatMoney(service.basePrice + service.therapistFee),
      }));
    }
    case "vouchers": {
      const vouchers = await db.voucher.findMany({ include: { _count: { select: { usages: true } } }, orderBy: { createdAt: "desc" } });
      return vouchers.map((voucher) => ({
        primary: voucher.code,
        secondary: voucher.name,
        meta: `${voucher.discountType} · ${voucher.discountValue}`,
        status: voucher.isActive ? "Đang hoạt động" : "Tạm dừng",
        value: `${voucher._count.usages}/${voucher.maxUsage ?? "∞"} lượt`,
      }));
    }
    case "packages": {
      const packages = await db.packagePlan.findMany({ include: { _count: { select: { customerPacks: true } } }, orderBy: { price: "asc" } });
      return packages.map((plan) => ({
        primary: plan.name,
        secondary: `${plan.sessions} buổi`,
        meta: `${plan.validityDays} ngày`,
        status: "Đang hoạt động",
        value: `${formatMoney(plan.price)} · đã bán ${plan._count.customerPacks}`,
      }));
    }
    case "campaigns":
    case "reports": {
      const campaigns = await db.campaign.findMany({
        where: branchId ? { bookings: { some: { branchId } } } : {},
        include: { bookings: { where: branchId ? { branchId } : {}, select: { status: true, totalAmount: true } } },
        orderBy: { createdAt: "desc" },
      });
      return campaigns.map((campaign) => {
        const completed = campaign.bookings.filter((booking) => booking.status === "COMPLETED");
        const revenue = completed.reduce((sum, booking) => sum + booking.totalAmount, 0);
        const totalCost = campaign.manualCost * completed.length;
        return {
          primary: campaign.name,
          secondary: campaign.source,
          meta: `${completed.length}/${campaign.bookings.length} hoàn tất`,
          status: campaign.code,
          value: `${formatMoney(revenue)} · chi phí ${formatMoney(totalCost)}`,
        };
      });
    }
    case "reminders": {
      const reminders = await db.reminder.findMany({ where: branchId ? { booking: { is: { branchId } } } : {}, include: { customer: true, booking: true }, orderBy: { dueAt: "desc" }, take: 300 });
      return reminders.map((reminder) => ({
        primary: reminder.title,
        secondary: `${reminder.customer.fullName} · ${reminder.customer.phone}`,
        meta: reminder.type,
        status: resourceStatusLabel(reminder.status),
        value: reminder.dueAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
        branchId: reminder.booking?.branchId,
      }));
    }
    case "office-events": {
      const events = await db.officeEvent.findMany({ where: branchId ? { branchId } : {}, include: { leadTherapist: true, _count: { select: { registrations: true } } }, orderBy: { startsAt: "desc" } });
      return events.map((event) => ({
        primary: event.companyName,
        secondary: event.location,
        meta: `${event.headcount} người · ${event.requiredTherapists} KTV · ${event.leadTherapist?.fullName ?? "chưa phân công KTV trưởng"}`,
        status: event.status === "AWAITING_DEPOSIT" ? "Chờ cọc" : event.status === "DEPOSIT_CONFIRMED" ? "Cần phân công" : event.status === "READY" ? "Sẵn sàng" : event.status === "IN_SERVICE" ? "Đang phục vụ" : event.status === "AWAITING_BALANCE" ? "Chờ thanh toán" : event.status === "COMPLETED" ? "Đã hoàn tất" : "Đã hủy",
        value: `${formatMoney(event.paidAmount)}/${formatMoney(event.totalAmount)}`,
        href: `/admin/business/${event.eventCode}`,
        branchId: event.branchId,
      }));
    }
    case "settings": {
      const [branches, roleCounts] = await Promise.all([
        db.branch.findMany({ where: branchId ? { id: branchId } : {}, orderBy: { id: "asc" } }),
        db.user.groupBy({ by: ["role"], where: branchId ? { branchId } : {}, _count: { _all: true } }),
      ]);
      return [
        ...branches.map((branch) => ({
          primary: branch.name,
          secondary: branch.address,
          meta: `${branch.openTime}–${branch.closeTime} · nhận ca cuối ${branch.lastBookingTime}`,
          status: "Đang hoạt động",
          value: `${branch.seatCapacity} giường · buffer ${branch.bufferMinutes} phút`,
          branchId: branch.id,
        })),
        ...roleCounts.map((item) => ({
          primary: `Vai trò ${item.role}`,
          secondary: "Phân quyền từ tài khoản CSDL",
          meta: "Phiên đăng nhập phía máy chủ",
          status: "Đã cấu hình",
          value: `${item._count._all} tài khoản`,
        })),
        { primary: "Thông báo", secondary: "Theo sự kiện booking, tài chính, CRM và Affiliate", meta: "Lưu trạng thái đã đọc trong CSDL", status: "Đang hoạt động", value: "Đồng bộ theo vai trò" },
      ];
    }
  }
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in adminSections)) notFound();

  const slug = section as SectionSlug;
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role === "THERAPIST" || !canAccessAdminSection(session, slug)) notFound();
  if (slug === "bookings") return <AdminBookingOperations />;
  if (slug === "calendar") return <AdminCalendarOperations />;
  if (slug === "affiliates") return <AdminAffiliateCenter />;
  if (slug === "customers") return <AdminCustomerTimeline />;
  if (slug === "rooms") return <AdminRoomOperations />;
  if (slug === "therapists") return <AdminTherapistOperations />;
  if (slug === "services") {
    const services = await db.service.findMany({
      include: { _count: { select: { bookings: true, packagePlans: true, therapists: true, vouchers: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return <AdminServiceOperations initialServices={services.map((service) => ({ ...service, updatedAt: service.updatedAt.toISOString() }))} />;
  }
  if (slug === "vouchers") {
    const [vouchers, services, campaigns] = await Promise.all([
      db.voucher.findMany({
        include: { _count: { select: { usages: true, bookings: true } } },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      }),
      db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true, isOnline: true } }),
      db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, code: true } }),
    ]);
    return <AdminVoucherOperations
      initialVouchers={vouchers.map((voucher) => ({
        ...voucher,
        startsAt: voucher.startsAt?.toISOString() ?? null,
        endsAt: voucher.endsAt?.toISOString() ?? null,
        createdAt: voucher.createdAt.toISOString(),
        updatedAt: voucher.updatedAt.toISOString(),
      }))}
      services={services.map((service) => ({ id: service.id, label: service.name, active: service.isActive && service.isOnline }))}
      campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: `${campaign.code} · ${campaign.name}` }))}
    />;
  }
  if (slug === "packages") {
    const [packages, services, branches] = await Promise.all([
      db.packagePlan.findMany({
        include: { _count: { select: { customerPacks: true } } },
        orderBy: [{ isActive: "desc" }, { price: "asc" }, { createdAt: "asc" }],
      }),
      db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, isActive: true, isOnline: true } }),
      db.branch.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    ]);
    const planOptions = packages.map((plan) => ({ id: plan.id, name: plan.name, price: plan.price, sessions: plan.sessions, serviceId: plan.serviceId, validityDays: plan.validityDays }));
    const serviceOptions = services.map((service) => ({ id: service.id, label: service.name, active: service.isActive }));
    const branchOptions = branches.map((branch) => ({ id: branch.id, label: branch.name.replace(/^Tâm An Center · /, "") }));
    return <>
      <CustomerPackageManager plans={planOptions} services={serviceOptions} branches={branchOptions} role={session.role} defaultBranchId={session.branchId} />
      {session.role === "OWNER" ? <AdminPackageOperations
        initialPackages={packages.map((plan) => ({ ...plan, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString() }))}
        services={services.map((service) => ({ id: service.id, label: service.name, active: service.isActive && service.isOnline }))}
      /> : null}
    </>;
  }
  if (slug === "settings") {
    if (!["OWNER", "BRANCH_MANAGER"].includes(session.role)) notFound();
    const [settings, settingBranches] = await Promise.all([
      db.systemSetting.findMany({
        where: session.role === "OWNER" ? {} : { OR: [{ branchId: null }, { branchId: session.branchId }] },
        orderBy: [{ category: "asc" }, { branchId: "asc" }, { label: "asc" }],
      }),
      db.branch.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    ]);
    return <AdminSettingsCenter
      initialSettings={settings.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() }))}
      branches={settingBranches.map((branch) => ({ id: branch.id, label: branch.name.replace(/^Tâm An Center · /, "") }))}
      role={session.role as "OWNER" | "BRANCH_MANAGER"}
      activeBranchId={session.branchId}
    />;
  }

  const [rows, branches] = await Promise.all([
    rowsFor(slug, session),
    db.branch.findMany({
      where: session.role === "OWNER" ? {} : { id: session.branchId ?? "__none__" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <AdminSectionContent
      section={slug}
      title={adminSections[slug]}
      rows={rows}
      branches={branches.map((branch) => ({ id: branch.id, label: branch.name.replace(/^Tâm An Center · /, "") }))}
    />
  );
}
