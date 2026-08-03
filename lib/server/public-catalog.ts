import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { BOOKING_POLICY } from "@/lib/business-policy";
import type { PublicCatalog } from "@/lib/catalog-types";

function dateLabel(value: Date | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(value);
}

async function loadPublicCatalog(): Promise<PublicCatalog> {
  const now = new Date();
  // PGlite (used for the local/demo runtime) shares a single socket and can
  // terminate concurrent reads. Sequential reads are also safe on PostgreSQL.
  const branches = await db.branch.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { therapists: { where: { status: "ACTIVE" } } } } },
  });
  const services = await db.service.findMany({
    where: { isActive: true, isOnline: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const therapists = await db.therapist.findMany({
    where: { status: "ACTIVE", onlineBooking: true, profileApprovalStatus: "APPROVED" },
    include: { services: { where: { isActive: true, isOnline: true }, select: { id: true } } },
    orderBy: [{ branchId: "asc" }, { ratingAvg: "desc" }, { fullName: "asc" }],
  });
  const vouchers = await db.voucher.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "asc" },
  });
  const packagePlans = await db.packagePlan.findMany({
    where: { isActive: true },
    orderBy: [{ price: "asc" }, { createdAt: "asc" }],
  });

  return {
    branches: branches.map((item) => ({
      id: item.id,
      label: item.name.replace(/^Tâm An Care · /, ""),
      address: item.address,
      phone: item.phone ?? "",
      seatCapacity: item.seatCapacity,
      therapistCapacity: item._count.therapists,
      openTime: item.openTime,
      closeTime: item.closeTime,
      lastBookingTime: item.lastBookingTime,
    })),
    services: services.map((item, index) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      category: item.category,
      description: item.description,
      durationMin: item.durationMin,
      basePrice: item.basePrice,
      therapistFee: item.therapistFee,
      popular: index < 3,
    })),
    therapists: therapists.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      branchId: item.branchId,
      skills: item.skills,
      avatarUrl: item.avatarUrl,
      publicBio: item.publicBio,
      publicStrengths: item.publicStrengths,
      ratingAvg: item.ratingAvg,
      servedCount: item.servedCount,
      repeatCount: item.repeatCount,
      status: item.status,
      serviceIds: item.services.map((service) => service.id),
    })),
    vouchers: vouchers.map((item) => ({
      code: item.code,
      name: item.name,
      description: item.description,
      type: item.discountType,
      value: item.discountValue,
      minSpend: item.minimumSpend,
      expiresAt: dateLabel(item.endsAt),
      constraint: item.displayConstraint || item.description,
      accent: item.accentColor,
      active: item.isActive,
    })),
    packagePlans: packagePlans.map((item) => ({
      id: item.id,
      name: item.name,
      paidSessions: item.paidSessions,
      bonusSessions: item.bonusSessions,
      sessions: item.sessions,
      price: item.price,
      validityDays: item.validityDays,
      badge: item.badge,
      highlight: item.isHighlighted,
      shareable: item.shareable,
      transferable: item.transferable,
      serviceId: item.serviceId,
    })),
    depositPercent: BOOKING_POLICY.depositPercent,
    priceNote: BOOKING_POLICY.priceNote,
  };
}

// The catalog is shared public data and changes far less often than booking,
// availability, payment, or session data. A short cache removes five database
// roundtrips from the main customer routes without making operational data stale.
export const getPublicCatalog = unstable_cache(
  loadPublicCatalog,
  ["public-catalog-v1"],
  { revalidate: 30, tags: ["public-catalog"] },
);
