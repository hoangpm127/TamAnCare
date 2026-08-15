import { addDays } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { packagePaymentConfig } from "@/lib/public-payment-config";
import { getCustomerSession } from "@/lib/server/customer-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { PackageReferralError, recordPackageLedger, resolvePackageReferrer } from "@/lib/server/package-ledger";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { consumeRateLimit, isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({
  planId: z.string().min(1),
  purpose: z.literal("package"),
  paymentCode: z.string().min(8).max(80),
  referrer: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const account = await getCustomerSession();
  if (!account) return NextResponse.json({ error: "Bạn cần đăng nhập để mua và quản lý gói thành viên." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin thanh toán gói chưa hợp lệ." }, { status: 400 });
  const rateLimit = await consumeRateLimit({
    scope: "package-purchase-intent",
    identifier: account.customerId,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Bạn đã tạo quá nhiều yêu cầu mua gói. Vui lòng thử lại sau." }, { status: 429 });
  }

  const plan = await db.packagePlan.findFirst({
    where: {
      id: parsed.data.planId,
      isActive: true,
      OR: [
        { serviceId: null },
        { service: { is: { isActive: true, isOnline: true } } },
      ],
    },
    include: { service: { select: { name: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Không tìm thấy gói thành viên." }, { status: 404 });
  const accountingBranchSetting = await db.systemSetting.findUnique({
    where: { scopeKey: "GLOBAL:business.accounting_branch_id" },
    select: { value: true },
  });
  const branch = accountingBranchSetting?.value
    ? await db.branch.findUnique({ where: { id: accountingBranchSetting.value } })
    : await db.branch.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (!branch) return NextResponse.json({ error: "Chưa cấu hình cơ sở hạch toán." }, { status: 503 });

  try {
    const result = await db.$transaction(async (tx) => {
      const referrer = await resolvePackageReferrer(tx, parsed.data.referrer, account.customerId);
      const pendingPackage = await tx.customerPackage.findFirst({
      where: {
        customerId: account.customerId,
        packagePlanId: plan.id,
        referrerInput: referrer.input,
        status: "PAUSED",
        paymentTransaction: { status: "PENDING", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
      },
      include: { paymentTransaction: true },
      orderBy: { createdAt: "desc" },
    });
      if (pendingPackage?.paymentTransaction) {
        return { payment: pendingPackage.paymentTransaction, customerPackage: pendingPackage, idempotent: true };
      }

      const idempotencyKey = `package:${account.customerId}:${parsed.data.paymentCode}`;
      const existing = await tx.paymentTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const customerPackage = await tx.customerPackage.findUnique({ where: { paymentTransactionId: existing.id } });
        return { payment: existing, customerPackage, idempotent: true };
      }
      const payment = await tx.paymentTransaction.create({
      data: {
        branchId: branch.id,
        customerId: account.customerId,
        type: "SERVICE_PAYMENT",
        direction: "IN",
        status: "PENDING",
        amount: plan.price,
        method: "BANK_TRANSFER_SEPAY",
        bankCode: packagePaymentConfig.bankId,
        paymentCode: buildPaymentCode(parsed.data.paymentCode, "SERVICE_PAYMENT"),
        idempotencyKey,
        note: `Mua gói thành viên · ${plan.name} · chờ ngân hàng đối soát`,
      },
    });
      const customerPackage = await tx.customerPackage.create({
      data: {
        customerId: account.customerId,
        packagePlanId: plan.id,
        paymentTransactionId: payment.id,
        campaignId: referrer.campaignId,
        referrerCustomerId: referrer.customerId,
        referrerInput: referrer.input,
        referrerName: referrer.name,
        referrerPhone: referrer.phone,
        planNameSnapshot: plan.name,
        planPriceSnapshot: plan.price,
        serviceIdSnapshot: plan.serviceId,
        serviceNameSnapshot: plan.service?.name ?? null,
        validityDaysSnapshot: plan.validityDays,
        shareableSnapshot: plan.shareable,
        transferableSnapshot: plan.transferable,
        sessionsTotal: plan.sessions,
        sessionsRemaining: plan.sessions,
        expiresAt: addDays(new Date(), plan.validityDays),
        status: "PAUSED",
        note: "Chờ đối soát thanh toán để kích hoạt.",
      },
    });
      await recordPackageLedger(tx, {
        customerPackageId: customerPackage.id,
        packagePlanId: plan.id,
        customerId: account.customerId,
        branchId: branch.id,
        paymentTransactionId: payment.id,
        event: "PURCHASE_CREATED",
        availableDelta: plan.sessions,
        description: `Tạo yêu cầu mua ${plan.name}`,
        metadata: { paymentStatus: "PENDING", referrerInput: referrer.input },
        idempotencyKey: `package:purchase:${customerPackage.id}`,
      });
      if (referrer.input) {
        await recordPackageLedger(tx, {
          customerPackageId: customerPackage.id,
          packagePlanId: plan.id,
          customerId: account.customerId,
          branchId: branch.id,
          paymentTransactionId: payment.id,
          event: "REFERRAL_CAPTURED",
          description: referrer.customerId
            ? `Đã xác định người giới thiệu: ${referrer.name}`
            : `Đã lưu thông tin người giới thiệu: ${referrer.input}`,
          metadata: {
            input: referrer.input,
            resolvedCustomerId: referrer.customerId,
            campaignId: referrer.campaignId,
          },
          idempotencyKey: `package:referral:${customerPackage.id}`,
        });
      }
      await notifyCustomer(tx, account.customerId, {
      branchId: branch.id,
      type: "PAYMENT",
      title: `Chờ đối soát ${plan.name}`,
      body: `Chuyển đúng số tiền và nội dung VietQR; thẻ chỉ được kích hoạt sau khi ngân hàng xác nhận.`,
      actionUrl: "/uu-dai",
    });
      return { payment, customerPackage, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      persisted: true,
      idempotent: result.idempotent,
      packageStatus: result.customerPackage?.status,
      payment: {
        id: result.payment.id,
        status: result.payment.status,
        amount: result.payment.amount,
        receivedAmount: result.payment.receivedAmount,
        paymentCode: result.payment.paymentCode,
        purpose: "package",
      },
    }, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    if (error instanceof PackageReferralError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
