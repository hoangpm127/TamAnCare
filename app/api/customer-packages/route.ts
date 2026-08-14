import { addDays } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type PackageStatus } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { recordPackageLedger } from "@/lib/server/package-ledger";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const allowedRoles = ["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"] as const;
const statuses = new Set<PackageStatus>(["ACTIVE", "EXPIRED", "PAUSED", "USED_UP"]);

const createSchema = z.object({
  customerId: z.string().min(1),
  packagePlanId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  sessionsTotal: z.coerce.number().int().min(1).max(10_000).optional(),
  sessionsRemaining: z.coerce.number().int().min(0).max(10_000).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  amountPaid: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  paymentMethod: z.enum(["CASH", "CARD_POS", "BANK_TRANSFER_MANUAL"]).default("BANK_TRANSFER_MANUAL"),
  note: z.string().trim().max(1000).optional(),
});

const include = {
  customer: { select: { id: true, fullName: true, phone: true } },
  packagePlan: { select: { id: true, name: true, price: true, sessions: true, serviceId: true, validityDays: true } },
  paymentTransaction: { select: { id: true, status: true, amount: true, method: true, paidAt: true, paymentCode: true } },
  ledgerEntries: {
    orderBy: [{ occurredAt: "desc" as const }, { id: "desc" as const }],
    take: 12,
    select: { id: true, event: true, availableDelta: true, reservedDelta: true, usedDelta: true, amount: true, description: true, occurredAt: true, booking: { select: { bookingCode: true } } },
  },
  _count: { select: { bookings: true, ledgerEntries: true } },
} satisfies Prisma.CustomerPackageInclude;

function serialize<T extends { expiresAt: Date; activatedAt: Date | null; createdAt: Date; updatedAt: Date; paymentTransaction: { paidAt: Date | null } | null; ledgerEntries: Array<{ occurredAt: Date }> }>(item: T) {
  return {
    ...item,
    expiresAt: item.expiresAt.toISOString(),
    activatedAt: item.activatedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    paymentTransaction: item.paymentTransaction ? { ...item.paymentTransaction, paidAt: item.paymentTransaction.paidAt?.toISOString() ?? null } : null,
    ledgerEntries: item.ledgerEntries.map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() })),
  };
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !allowedRoles.includes(session.role as (typeof allowedRoles)[number])) {
    return NextResponse.json({ error: "Bạn không có quyền quản lý Gói dài hạn của khách." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim().slice(0, 120) ?? "";
  const rawStatus = params.get("status") as PackageStatus | null;
  const status = rawStatus && statuses.has(rawStatus) ? rawStatus : null;
  const where: Prisma.CustomerPackageWhereInput = {
    ...(status ? { status } : {}),
    ...(query ? {
      OR: [
        { customer: { is: { fullName: { contains: query, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: query } } } },
        { packagePlan: { is: { name: { contains: query, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const [packages, counts] = await Promise.all([
    db.customerPackage.findMany({ where, include, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 100 }),
    db.customerPackage.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return NextResponse.json({
    packages: packages.map(serialize),
    summary: Object.fromEntries(counts.map((item) => [item.status, item._count._all])),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !allowedRoles.includes(session.role as (typeof allowedRoles)[number])) {
    return NextResponse.json({ error: "Bạn không có quyền cấp Gói dài hạn cho khách." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin gói chưa hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const [customer, plan] = await Promise.all([
    db.customer.findUnique({ where: { id: input.customerId } }),
    db.packagePlan.findUnique({ where: { id: input.packagePlanId }, include: { service: { select: { name: true } } } }),
  ]);
  if (!customer) return NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "Không tìm thấy mẫu gói." }, { status: 404 });
  const branchId = session.role === "OWNER" ? input.branchId : session.branchId;
  const branch = branchId
    ? await db.branch.findUnique({ where: { id: branchId } })
    : await db.branch.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (!branch) return NextResponse.json({ error: "Chưa xác định được cơ sở ghi nhận gói." }, { status: 400 });
  const sessionsTotal = input.sessionsTotal ?? plan.sessions;
  const sessionsRemaining = input.sessionsRemaining ?? sessionsTotal;
  if (sessionsRemaining > sessionsTotal) return NextResponse.json({ error: "Số lượt còn lại không thể lớn hơn tổng số lượt." }, { status: 400 });
  const now = new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : addDays(now, plan.validityDays);
  if (expiresAt <= now) return NextResponse.json({ error: "Hạn sử dụng phải ở tương lai." }, { status: 400 });

  const created = await db.$transaction(async (tx) => {
    let customerPackage = await tx.customerPackage.create({
      data: {
        customerId: customer.id,
        packagePlanId: plan.id,
        planNameSnapshot: plan.name,
        planPriceSnapshot: input.amountPaid || plan.price,
        serviceIdSnapshot: plan.serviceId,
        serviceNameSnapshot: plan.service?.name ?? null,
        validityDaysSnapshot: plan.validityDays,
        shareableSnapshot: plan.shareable,
        transferableSnapshot: plan.transferable,
        sessionsTotal,
        sessionsRemaining,
        expiresAt,
        status: sessionsRemaining === 0 ? "USED_UP" : "ACTIVE",
        activatedAt: now,
        note: input.note || "Cấp tại quầy.",
      },
    });

    let paymentTransactionId: string | null = null;
    if (input.amountPaid > 0) {
      const payment = await tx.paymentTransaction.create({
        data: {
          branchId: branch.id,
          customerId: customer.id,
          type: "SERVICE_PAYMENT",
          direction: "IN",
          status: "CONFIRMED",
          amount: input.amountPaid,
          receivedAmount: input.amountPaid,
          method: input.paymentMethod,
          paymentCode: `PKG-${customerPackage.id}`,
          idempotencyKey: `package:counter:${customerPackage.id}`,
          note: `Bán Gói dài hạn tại quầy · ${plan.name}`,
          paidAt: now,
        },
      });
      paymentTransactionId = payment.id;
      customerPackage = await tx.customerPackage.update({ where: { id: customerPackage.id }, data: { paymentTransactionId: payment.id } });
      await tx.ledgerEntry.create({
        data: {
          branchId: branch.id,
          customerId: customer.id,
          paymentTransactionId: payment.id,
          category: "PACKAGE_REVENUE",
          direction: "IN",
          amount: input.amountPaid,
          description: `Gói dài hạn · ${plan.name}`,
          occurredAt: now,
        },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { totalSpend: { increment: input.amountPaid }, segment: "LONG_TERM" } });
    } else {
      await tx.customer.update({ where: { id: customer.id }, data: { segment: "LONG_TERM" } });
    }
    await recordPackageLedger(tx, {
      customerPackageId: customerPackage.id,
      packagePlanId: plan.id,
      customerId: customer.id,
      branchId: branch.id,
      paymentTransactionId,
      event: input.amountPaid > 0 ? "ACTIVATED" : "BALANCE_IMPORTED",
      availableDelta: sessionsRemaining,
      amount: input.amountPaid,
      description: input.amountPaid > 0 ? `Bán và kích hoạt ${plan.name} tại quầy` : `Cấp ${plan.name} tại quầy`,
      metadata: { sessionsTotal, sessionsRemaining, actorUserId: session.id },
      idempotencyKey: `package:counter:create:${customerPackage.id}`,
      occurredAt: now,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: branch.id,
        action: "CUSTOMER_PACKAGE_CREATE",
        entityType: "CustomerPackage",
        entityId: customerPackage.id,
        after: { customerId: customer.id, packagePlanId: plan.id, sessionsTotal, sessionsRemaining, amountPaid: input.amountPaid, expiresAt },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    await notifyCustomer(tx, customer.id, {
      branchId: branch.id,
      type: "PROMOTION",
      title: `Đã kích hoạt ${plan.name}`,
      body: `${sessionsRemaining} lượt khả dụng · hạn dùng đến ${expiresAt.toLocaleDateString("vi-VN")}.`,
      actionUrl: "/toi",
    });
    return tx.customerPackage.findUniqueOrThrow({ where: { id: customerPackage.id }, include });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.json({ package: serialize(created) }, { status: 201 });
}
