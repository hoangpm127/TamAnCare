import { addHours } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { money, notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { consumeRateLimit, isSameOriginMutation } from "@/lib/server/request-security";
import { getBusinessCatalog } from "@/lib/server/business-catalog";
import { calculatePaymentBreakdown } from "@/lib/payment-policy";
import { attachBusinessAttribution } from "@/lib/server/xgroup-attribution";

const schema = z.object({
  inquiryCode: z.string().trim().min(4).max(50),
  companyName: z.string().trim().min(2).max(200),
  taxCode: z.string().trim().min(3).max(50),
  officeAddress: z.string().trim().min(5).max(500),
  contactName: z.string().trim().min(2).max(150),
  contactPhone: z.string().trim().min(8).max(20),
  startsAt: z.string().datetime({ offset: true }),
  timeWindow: z.string().trim().max(50),
  headcount: z.number().int().positive().max(500),
  durationMin: z.number().int().positive().max(240),
  trialId: z.string().trim().min(2).max(50),
  wantsCorporatePackage: z.boolean(),
  tierId: z.string().trim().min(2).max(50).optional(),
  serviceLabel: z.string().trim().min(2).max(200),
  packageTier: z.string().trim().max(100).optional(),
  totalAmount: z.number().int().nonnegative(),
  depositAmount: z.number().int().nonnegative(),
  bankCode: z.string().trim().min(2).max(30).optional(),
  referralCode: z.string().trim().min(4).max(32).optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin yêu cầu Business chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const guestSession = await ensureGuestSession();
  const rateLimit = await consumeRateLimit({
    scope: "corporate-inquiry-v2",
    identifier: `${guestSession.id}:${input.contactPhone.replace(/\D/g, "")}`,
    limit: 10,
    windowMs: 60 * 60_000,
    blockMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Bạn đã gửi quá nhiều yêu cầu Business. Vui lòng thử lại sau." }, { status: 429 });
  const businessCatalog = await getBusinessCatalog();
  if (!businessCatalog.onsiteProgram.deploymentEnabled) {
    return NextResponse.json({ error: "Chương trình onsite hiện chưa nhận lịch mới." }, { status: 503 });
  }
  const trial = businessCatalog.trialPackages.find((item) => item.id === input.trialId);
  const tier = input.wantsCorporatePackage ? businessCatalog.packageTiers.find((item) => item.id === input.tierId) : undefined;
  if (!trial || (input.wantsCorporatePackage && !tier)) return NextResponse.json({ error: "Gói Business không tồn tại." }, { status: 404 });
  if (tier && (input.headcount < tier.minHeadcountPerSession || input.headcount > tier.maxHeadcountPerSession)) {
    return NextResponse.json({ error: "Số nhân sự không nằm trong phạm vi của gói Business đã chọn." }, { status: 409 });
  }
  const subtotal = input.headcount * trial.pricePerPerson;
  const discount = tier ? Math.round(subtotal * tier.discountPercent / 100) : 0;
  const capacityPerTherapist = Math.max(1, Math.floor(60 / trial.durationMin));
  const requiredTherapists = Math.max(
    businessCatalog.onsiteProgram.minimumTherapistsPerSession,
    Math.ceil(input.headcount / capacityPerTherapist),
  );
  const transportFee = tier?.id === "corp-complete" ? 0 : requiredTherapists * businessCatalog.transportFee.feePerTherapist;
  const paymentBreakdown = calculatePaymentBreakdown({
    originalAmount: subtotal + transportFee,
    discountAmount: discount,
    depositPercent: businessCatalog.depositPolicy.percent,
  });
  const serverTotal = paymentBreakdown.totalAmount;
  const serverDeposit = paymentBreakdown.depositAmount;
  if (input.durationMin !== trial.durationMin || input.totalAmount !== serverTotal || input.depositAmount !== serverDeposit) {
    return NextResponse.json({ error: "Báo giá đã thay đổi. Vui lòng tải lại để nhận số tiền chính xác.", totalAmount: serverTotal, depositAmount: serverDeposit }, { status: 409 });
  }
  const serviceLabel = trial.name;
  const packageTier = tier?.name;
  const branch = await db.branch.findUnique({ where: { id: businessCatalog.accountingBranchId } });
  if (!branch) return NextResponse.json({ error: "Chưa cấu hình cơ sở hạch toán Business." }, { status: 503 });

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { phone: input.contactPhone.replace(/\s+/g, "") },
      create: { fullName: input.contactName, phone: input.contactPhone.replace(/\s+/g, ""), firstSource: "TUE_TAM_BUSINESS", commonIssues: [] },
      update: { fullName: input.contactName, firstSource: "TUE_TAM_BUSINESS" },
    });
    const existingPayment = await tx.paymentTransaction.findUnique({ where: { idempotencyKey: `business-deposit:${input.inquiryCode}` } });
    if (existingPayment) {
      const existingEvent = await tx.officeEvent.findUnique({ where: { eventCode: input.inquiryCode } });
      if (!existingEvent) throw new Error("business_event_missing_for_payment");
      await tx.paymentAccessGrant.upsert({
        where: { guestSessionId_paymentTransactionId: { guestSessionId: guestSession.id, paymentTransactionId: existingPayment.id } },
        create: { guestSessionId: guestSession.id, paymentTransactionId: existingPayment.id, expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
        update: { expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
      });
      await tx.businessAccessGrant.upsert({
        where: { guestSessionId_officeEventId: { guestSessionId: guestSession.id, officeEventId: existingEvent.id } },
        create: { guestSessionId: guestSession.id, officeEventId: existingEvent.id, expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
        update: { expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
      });
      return { customer, event: existingEvent, payment: existingPayment, idempotent: true };
    }

    const startsAt = new Date(input.startsAt);
    const event = await tx.officeEvent.upsert({
      where: { eventCode: input.inquiryCode },
      create: {
        branchId: branch.id,
        customerId: customer.id,
        eventCode: input.inquiryCode,
        companyName: input.companyName,
        contactName: input.contactName,
        contactPhone: input.contactPhone.replace(/\s+/g, ""),
        taxCode: input.taxCode,
        location: input.officeAddress,
        serviceLabel,
        packageTier,
        headcount: input.headcount,
        durationMin: input.durationMin,
        requiredTherapists,
        sessionsTotal: tier ? tier.sessionsPerMonth + tier.bonusSessions : 1,
        startsAt,
        endsAt: addHours(startsAt, 1),
        slotMinutes: input.durationMin,
        subtotalAmount: subtotal,
        discountAmount: discount,
        transportFee,
        totalAmount: serverTotal,
        depositAmount: serverDeposit,
        paidAmount: 0,
        paymentStatus: "UNPAID",
        status: "AWAITING_DEPOSIT",
        voucherCode: packageTier,
        onsiteAssets: businessCatalog.onsiteProgram.requiredAssets,
        returnVoucherCode: businessCatalog.onsiteProgram.returnVoucher.code,
      },
      update: {
        customerId: customer.id,
        companyName: input.companyName,
        contactName: input.contactName,
        contactPhone: input.contactPhone.replace(/\s+/g, ""),
        taxCode: input.taxCode,
        location: input.officeAddress,
        serviceLabel,
        packageTier,
        headcount: input.headcount,
        durationMin: input.durationMin,
        requiredTherapists,
        sessionsTotal: tier ? tier.sessionsPerMonth + tier.bonusSessions : 1,
        startsAt,
        endsAt: addHours(startsAt, 1),
        slotMinutes: input.durationMin,
        subtotalAmount: subtotal,
        discountAmount: discount,
        transportFee,
        totalAmount: serverTotal,
        depositAmount: serverDeposit,
        voucherCode: packageTier,
        onsiteAssets: businessCatalog.onsiteProgram.requiredAssets,
        returnVoucherCode: businessCatalog.onsiteProgram.returnVoucher.code,
      },
    });
    await tx.officeRegistration.create({
      data: {
        eventId: event.id,
        customerId: customer.id,
        fullName: input.contactName,
        phone: input.contactPhone.replace(/\s+/g, ""),
        slotTime: startsAt,
        voucherCode: packageTier,
      },
    });
    const attribution = await attachBusinessAttribution(tx, {
      officeEventId: event.id,
      eventCode: event.eventCode,
      companyName: event.companyName,
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      officeAddress: event.location,
      grossAmount: event.totalAmount,
      referralCode: input.referralCode,
    });
    const payment = await tx.paymentTransaction.create({
      data: {
        officeEventId: event.id,
        branchId: branch.id,
        customerId: customer.id,
        type: "DEPOSIT",
        direction: "IN",
        status: "PENDING",
        amount: input.depositAmount,
        method: "BANK_TRANSFER_SEPAY",
        bankCode: input.bankCode,
        paymentCode: buildPaymentCode(input.inquiryCode, "DEPOSIT"),
        idempotencyKey: `business-deposit:${input.inquiryCode}`,
        note: `Business · ${input.companyName} · MST ${input.taxCode} · ${input.headcount} người · ${serviceLabel} · tổng ${money(serverTotal)} · ${input.timeWindow}`,
      },
    });
    await tx.paymentAccessGrant.create({
      data: {
        guestSessionId: guestSession.id,
        paymentTransactionId: payment.id,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.businessAccessGrant.create({
      data: {
        guestSessionId: guestSession.id,
        officeEventId: event.id,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });
    await notifyCustomer(tx, customer.id, {
      branchId: branch.id,
      type: "PAYMENT",
      title: "Yêu cầu Business đang chờ đối soát cọc",
      body: `${input.inquiryCode} · ${input.companyName} · vui lòng chuyển đúng ${money(input.depositAmount)} theo VietQR.`,
      actionUrl: `/doanh-nghiep/${event.eventCode}`,
    });
    await notifyOperations(tx, {
      branchId: branch.id,
      type: "BOOKING",
      title: `Yêu cầu Business mới · ${input.companyName}`,
      body: `${input.headcount} người · ${input.timeWindow} · chờ đối soát cọc ${money(input.depositAmount)}.`,
      actionUrl: `/admin/business/${event.eventCode}`,
    });
    const xgroupRecipients = await tx.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: "XGROUP_SUPER_ADMIN" },
          ...(attribution.district?.managerUserId ? [{ id: attribution.district.managerUserId }] : []),
        ],
      },
      select: { id: true },
    });
    if (xgroupRecipients.length) {
      await tx.notification.createMany({
        data: xgroupRecipients.map((recipient) => ({
          userId: recipient.id,
          type: "BOOKING" as const,
          title: `Cơ hội Business mới · ${input.companyName}`,
          body: `${attribution.district?.name ?? "Chưa phân tuyến"} · ${attribution.affiliate?.displayName ?? "Nguồn trực tiếp"} · GMV ${money(serverTotal)}.`,
          actionUrl: "/xgroup/reconciliation",
        })),
      });
    }
    return { customer, event, payment, idempotent: false };
  });

  return NextResponse.json({
    persisted: true,
    idempotent: result.idempotent,
    eventCode: result.event.eventCode,
    payment: {
      id: result.payment.id,
      status: result.payment.status,
      amount: result.payment.amount,
      receivedAmount: result.payment.receivedAmount,
      paymentCode: result.payment.paymentCode,
    },
  }, { status: result.idempotent ? 200 : 201 });
}
