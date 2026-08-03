import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";
import { calculateVoucherDiscount, voucherRuleError } from "@/lib/server/voucher-rules";

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
  const code = parsed.data.code.toUpperCase();
  const [voucher, customerSession] = await Promise.all([
    db.voucher.findFirst({
      where: {
        code,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    }),
    getCustomerSession(),
  ]);
  if (!voucher) return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Mã ưu đãi không còn hiệu lực." });
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
  if (code === "WELCOME100") {
    if (!customerSession) return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Hãy đăng nhập để dùng quyền lợi WELCOME100." });
    const account = await db.customerAccount.findUnique({ where: { customerId: customerSession.customerId } });
    if (!account || account.creditBalance <= 0) {
      return NextResponse.json({ valid: false, code, discountAmount: 0, message: "Quyền lợi WELCOME100 không còn khả dụng." });
    }
  }

  return NextResponse.json({
    valid: true,
    code,
    discountAmount: calculateVoucherDiscount(voucher, parsed.data.subtotal),
    message: `Đã áp dụng ${code}.`,
  });
}
