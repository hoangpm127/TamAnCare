import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { installedReferralForIdentity } from "@/lib/server/referral-installation";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";
import { calculateVoucherDiscount, voucherRuleError } from "@/lib/server/voucher-rules";
import { hasActiveWelcomeVoucher, WELCOME_VOUCHER_CODE } from "@/lib/welcome-voucher";

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.coerce.number().int().min(0).max(100_000_000),
  serviceIds: z.array(z.string().min(1).max(80)).max(20).default([]),
  startTime: z.string().datetime({ offset: true }).optional(),
  customerPhone: z.string().trim().regex(/^(?:\+?84|0)\d{9,10}$/).optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ valid: false, discountAmount: 0, message: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ valid: false, discountAmount: 0, message: "Mã ưu đãi hoặc giá trị đơn chưa hợp lệ." }, { status: 400 });
  const rateLimit = await consumeRateLimit({
    scope: "voucher-validate",
    identifier: requestIp(request),
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ valid: false, discountAmount: 0, message: "Bạn kiểm tra quá nhiều mã. Vui lòng thử lại sau." }, { status: 429 });

  const now = new Date();
  const requestedCode = parsed.data.code.toUpperCase();
  const [customerSession, guestSession] = await Promise.all([
    getCustomerSession(),
    getGuestSession(),
  ]);
  const installedReferral = await installedReferralForIdentity({
    guestSessionId: guestSession?.id,
    customerId: customerSession?.customerId,
  });
  if (requestedCode === "AFF50") {
    return NextResponse.json({
      valid: false,
      code: requestedCode,
      discountAmount: 0,
      message: "Quà giới thiệu 50K được tự động cộng cùng ưu đãi thành viên mới 150K khi bạn mở đúng link, cài app và chọn dịch vụ từ 200.000đ. Bạn không cần nhập mã AFF50.",
    });
  }
  const referralCodeAlias = Boolean(installedReferral && requestedCode === installedReferral.code);
  const code = referralCodeAlias ? "WELCOME150" : requestedCode;
  const voucher = await db.voucher.findFirst({
    where: {
      code,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });
  if (!voucher) {
    const affiliateCampaign = await db.campaign.findFirst({
      where: { code: requestedCode, source: { startsWith: "AFFILIATE:" } },
      select: { id: true },
    });
    return NextResponse.json({
      valid: false,
      code: requestedCode,
      discountAmount: 0,
      message: affiliateCampaign
        ? "Đây là mã giới thiệu, không phải mã voucher. Hãy mở đúng link hoặc QR lời mời; hệ thống sẽ tự cộng quyền lợi 150K + 50K."
        : "Mã ưu đãi không tồn tại hoặc đã hết thời hạn áp dụng.",
    });
  }
  if (voucher.serviceId && parsed.data.serviceIds.some((serviceId) => serviceId !== voucher.serviceId)) {
    return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Ưu đãi này không áp dụng cho dịch vụ đã chọn." });
  }

  const usageWhere = {
    voucherId: voucher.id,
    OR: [
      { status: "CONFIRMED" },
      { status: "RESERVED", expiresAt: { gt: now } },
    ],
  } satisfies Prisma.VoucherUsageWhereInput;
  const customer = customerSession
    ? await db.customer.findUnique({ where: { id: customerSession.customerId } })
    : parsed.data.customerPhone
      ? await db.customer.findUnique({ where: { phone: parsed.data.customerPhone.replace(/^\+84/, "0") } })
      : null;
  const [globalUsage, customerUsage, serviceRecords] = await Promise.all([
    voucher.maxUsage ? db.voucherUsage.count({ where: usageWhere }) : Promise.resolve(0),
    customer && voucher.maxPerCustomer
      ? db.voucherUsage.count({ where: { ...usageWhere, customerId: customer.id } })
      : Promise.resolve(0),
    db.service.findMany({ where: { id: { in: parsed.data.serviceIds } }, select: { durationMin: true } }),
  ]);
  if (voucher.maxUsage && globalUsage >= voucher.maxUsage) {
    return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Ưu đãi đã hết lượt sử dụng." });
  }
  if (voucher.maxPerCustomer && customerUsage >= voucher.maxPerCustomer) {
    return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Bạn đã sử dụng hoặc đang giữ ưu đãi này." });
  }
  const ruleError = voucherRuleError(voucher, {
    subtotal: parsed.data.subtotal,
    serviceDurations: serviceRecords.map((item) => item.durationMin),
    bookingStartTime: parsed.data.startTime,
    authenticated: Boolean(customerSession),
    phoneVerified: Boolean(customerSession?.phoneVerifiedAt),
    customer,
  });
  if (ruleError) return NextResponse.json({ valid: false, code, discountAmount: 0, message: ruleError });
  if (code === WELCOME_VOUCHER_CODE) {
    if (!customerSession) return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Hãy đăng nhập để dùng quyền lợi WELCOME150." });
    const account = await db.customerAccount.findUnique({ where: { customerId: customerSession.customerId } });
    if (!hasActiveWelcomeVoucher(account, now)) {
      return NextResponse.json({ valid: false, code, discountAmount: 0, message: "WELCOME150 đã hết hạn hoặc không còn khả dụng." });
    }
  }

  const primaryDiscount = calculateVoucherDiscount(voucher, parsed.data.subtotal);
  if (code === WELCOME_VOUCHER_CODE && customerSession && installedReferral) {
    const affiliateBonus = await db.voucher.findFirst({
      where: {
        code: "AFF50",
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });
    if (affiliateBonus) {
      const [bonusGlobalUsage, bonusCustomerUsage] = await Promise.all([
        affiliateBonus.maxUsage
          ? db.voucherUsage.count({ where: { voucherId: affiliateBonus.id, ...activeUsageFilter(now) } })
          : Promise.resolve(0),
        affiliateBonus.maxPerCustomer
          ? db.voucherUsage.count({ where: { voucherId: affiliateBonus.id, customerId: customerSession.customerId, ...activeUsageFilter(now) } })
          : Promise.resolve(0),
      ]);
      const bonusRuleError = voucherRuleError(affiliateBonus, {
        subtotal: parsed.data.subtotal,
        serviceDurations: serviceRecords.map((item) => item.durationMin),
        bookingStartTime: parsed.data.startTime,
        authenticated: true,
        phoneVerified: Boolean(customerSession.phoneVerifiedAt),
        customer,
      });
      if (!bonusRuleError
        && (!affiliateBonus.maxUsage || bonusGlobalUsage < affiliateBonus.maxUsage)
        && (!affiliateBonus.maxPerCustomer || bonusCustomerUsage < affiliateBonus.maxPerCustomer)) {
        const bonusDiscount = Math.min(
          Math.max(0, parsed.data.subtotal - primaryDiscount),
          calculateVoucherDiscount(affiliateBonus, parsed.data.subtotal),
        );
        return NextResponse.json({
          valid: true,
          code,
          ...(referralCodeAlias ? { canonicalCode: code } : {}),
          stackedCodes: [code, affiliateBonus.code],
          discountAmount: primaryDiscount + bonusDiscount,
          message: `Đã cộng ${code} và ${affiliateBonus.code}.`,
        });
      }
    }
  }

  return NextResponse.json({
    valid: true,
    code,
    ...(referralCodeAlias ? { canonicalCode: code } : {}),
    discountAmount: primaryDiscount,
    message: `Đã áp dụng ${code}.`,
  });
}

function activeUsageFilter(now: Date) {
  return {
    OR: [
      { status: "CONFIRMED" },
      { status: "RESERVED", expiresAt: { gt: now } },
    ],
  } satisfies Prisma.VoucherUsageWhereInput;
}
