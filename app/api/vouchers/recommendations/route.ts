import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { calculateVoucherDiscount, voucherRuleError } from "@/lib/server/voucher-rules";
import { rankVoucherCandidates, type VoucherAudience } from "@/lib/voucher-ranking";
import { hasActiveWelcomeVoucher, WELCOME_VOUCHER_CODE, welcomeVoucherExpiresAt } from "@/lib/welcome-voucher";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  startTime: z.string().datetime({ offset: true }).optional(),
  subtotal: z.coerce.number().int().min(0).max(100_000_000).default(0),
  serviceIds: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

function activeUsageFilter(now: Date) {
  return {
    OR: [
      { status: "CONFIRMED" },
      { status: "RESERVED", expiresAt: { gt: now } },
    ],
  } satisfies Prisma.VoucherUsageWhereInput;
}

function businessMinuteOfDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "0";
  return Number(part("hour")) * 60 + Number(part("minute"));
}

function expiryLabel(value: Date | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    startTime: url.searchParams.get("startTime") || undefined,
    subtotal: url.searchParams.get("subtotal") ?? 0,
    serviceIds: url.searchParams.getAll("serviceId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Ngữ cảnh gợi ý voucher chưa hợp lệ." }, { status: 400 });
  }

  const now = new Date();
  const effectiveStartTime = parsed.data.startTime ? new Date(parsed.data.startTime) : now;
  const account = await getCustomerSession();
  const customer = account?.customer ?? null;
  const welcomeVoucherAvailable = hasActiveWelcomeVoucher(account, now);
  const audience: VoucherAudience = !customer
    ? "ANONYMOUS"
    : customer.totalVisits > 0 || customer.lastVisitAt
      ? "RETURNING"
      : "NEW";

  const vouchers = await db.voucher.findMany({
    where: {
      isActive: true,
      code: { not: "AFF50" },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        { OR: [{ serviceId: null }, { service: { is: { isActive: true, isOnline: true } } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const voucherIds = vouchers.map((voucher) => voucher.id);
  const [serviceRecords, globalUsageGroups, customerUsages] = await Promise.all([
    db.service.findMany({
      where: { id: { in: parsed.data.serviceIds } },
      select: { id: true, durationMin: true },
    }),
    voucherIds.length
      ? db.voucherUsage.groupBy({
          by: ["voucherId"],
          where: { voucherId: { in: voucherIds }, ...activeUsageFilter(now) },
          _count: { voucherId: true },
        })
      : Promise.resolve([]),
    account && voucherIds.length
      ? db.voucherUsage.findMany({
          where: {
            customerId: account.customerId,
            voucherId: { in: voucherIds },
            ...activeUsageFilter(now),
          },
          select: { voucherId: true, status: true },
        })
      : Promise.resolve([]),
  ]);
  const globalUsageByVoucher = new Map(globalUsageGroups.map((item) => [item.voucherId, item._count.voucherId]));
  const customerUsageByVoucher = new Map<string, number>();
  for (const usage of customerUsages) {
    customerUsageByVoucher.set(usage.voucherId, (customerUsageByVoucher.get(usage.voucherId) ?? 0) + 1);
  }

  const ranked = rankVoucherCandidates(vouchers.map((voucher) => {
    const globalUsage = globalUsageByVoucher.get(voucher.id) ?? 0;
    const customerUsage = customerUsageByVoucher.get(voucher.id) ?? 0;
    const remaining = voucher.maxUsage === null ? null : Math.max(0, voucher.maxUsage - globalUsage);
    const inventoryAvailable = remaining === null || remaining > 0;
    const serviceMatches = !voucher.serviceId
      || parsed.data.serviceIds.length === 0
      || parsed.data.serviceIds.every((serviceId) => serviceId === voucher.serviceId);
    let eligibilityReason = !inventoryAvailable
      ? "Ưu đãi đã hết lượt sử dụng."
      : voucher.maxPerCustomer && customerUsage >= voucher.maxPerCustomer
        ? "Bạn đã sử dụng hoặc đang giữ ưu đãi này."
        : !serviceMatches
          ? "Ưu đãi không áp dụng cho dịch vụ đã chọn."
          : voucherRuleError(voucher, {
              subtotal: parsed.data.subtotal,
              serviceDurations: serviceRecords.map((service) => service.durationMin),
              bookingStartTime: effectiveStartTime,
              authenticated: Boolean(account),
              phoneVerified: Boolean(account?.phoneVerifiedAt),
              customer,
            });
    if (!eligibilityReason && voucher.code === WELCOME_VOUCHER_CODE && account && !welcomeVoucherAvailable) {
      eligibilityReason = "WELCOME150 đã hết hạn hoặc không còn khả dụng.";
    }
    const hideWelcome = voucher.code === WELCOME_VOUCHER_CODE && Boolean(account && (
      customerUsage > 0
      || !welcomeVoucherAvailable
      || (customer?.totalVisits ?? 0) > 0
    ));
    return {
      ...voucher,
      inventoryAvailable,
      eligible: !eligibilityReason,
      eligibilityReason,
      visible: !hideWelcome,
      remaining,
    };
  }), {
    audience,
    minuteOfDay: businessMinuteOfDay(effectiveStartTime),
    serviceIds: parsed.data.serviceIds,
  });

  const responseVouchers = ranked.map((voucher) => ({
    code: voucher.code,
    name: voucher.name,
    description: voucher.description,
    type: voucher.discountType,
    value: voucher.discountValue,
    minSpend: voucher.minimumSpend,
    expiresAt: voucher.code === WELCOME_VOUCHER_CODE
      ? account
        ? expiryLabel(welcomeVoucherExpiresAt(account.welcomeCreditGrantedAt))
        : "7 ngày kể từ ngày nhận"
      : expiryLabel(voucher.endsAt),
    constraint: voucher.displayConstraint || voucher.description,
    accent: voucher.accentColor,
    active: voucher.isActive,
    eligible: voucher.eligible,
    eligibilityReason: voucher.eligibilityReason,
    recommendationReason: voucher.recommendationReason,
    remaining: voucher.remaining,
    discountAmount: voucher.eligible ? calculateVoucherDiscount(voucher, parsed.data.subtotal) : 0,
  }));

  return NextResponse.json({
    audience,
    identityKnown: Boolean(account),
    effectiveStartTime: effectiveStartTime.toISOString(),
    recommendedCode: responseVouchers.find((voucher) => voucher.remaining === null || voucher.remaining > 0)?.code ?? null,
    vouchers: responseVouchers,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
