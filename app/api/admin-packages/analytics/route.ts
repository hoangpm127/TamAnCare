import { NextResponse } from "next/server";
import type { PackageStatus, Prisma, TransactionStatus } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

const PACKAGE_STATUSES = new Set<PackageStatus>(["ACTIVE", "EXPIRED", "PAUSED", "USED_UP"]);
const PAYMENT_STATUSES = new Set<TransactionStatus>(["PENDING", "CONFIRMED", "VOID", "REFUNDED"]);

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem báo cáo gói dài hạn." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim().slice(0, 120) ?? "";
  const planId = params.get("planId")?.trim() || "";
  const requestedStatus = params.get("status") as PackageStatus | null;
  const requestedPaymentStatus = params.get("paymentStatus") as TransactionStatus | null;
  const status = requestedStatus && PACKAGE_STATUSES.has(requestedStatus) ? requestedStatus : null;
  const paymentStatus = requestedPaymentStatus && PAYMENT_STATUSES.has(requestedPaymentStatus) ? requestedPaymentStatus : null;
  const page = positiveInteger(params.get("page"), 1, 100_000);
  const pageSize = positiveInteger(params.get("pageSize"), 30, 100);

  const where: Prisma.CustomerPackageWhereInput = {
    ...(planId ? { packagePlanId: planId } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentTransaction: { is: { status: paymentStatus } } } : {}),
    ...(query ? {
      OR: [
        { customer: { is: { fullName: { contains: query, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: query } } } },
        { packagePlan: { is: { name: { contains: query, mode: "insensitive" } } } },
        { referrerInput: { contains: query, mode: "insensitive" } },
        { referrerName: { contains: query, mode: "insensitive" } },
        { referrerPhone: { contains: query } },
        { paymentTransaction: { is: { paymentCode: { contains: query, mode: "insensitive" } } } },
      ],
    } : {}),
  };

  const [metricRows, purchaseCount, purchases, ledgerRows, financialLedger] = await Promise.all([
    db.customerPackage.findMany({
      where,
      select: {
        customerId: true,
        packagePlanId: true,
        status: true,
        sessionsTotal: true,
        sessionsRemaining: true,
        sessionsReserved: true,
        planNameSnapshot: true,
        referrerInput: true,
        packagePlan: { select: { name: true } },
        paymentTransaction: { select: { status: true, amount: true } },
      },
    }),
    db.customerPackage.count({ where }),
    db.customerPackage.findMany({
      where,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        referrerCustomer: { select: { id: true, fullName: true, phone: true } },
        packagePlan: { select: { id: true, name: true, price: true, sessions: true } },
        campaign: { select: { id: true, code: true, name: true } },
        paymentTransaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            receivedAmount: true,
            method: true,
            paymentCode: true,
            externalReference: true,
            paidAt: true,
            createdAt: true,
          },
        },
        _count: { select: { bookings: true, ledgerEntries: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.packageLedgerEntry.findMany({
      where: { customerPackage: { is: where } },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        packagePlan: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingCode: true } },
        bookingGroup: { select: { id: true, referenceCode: true } },
        paymentTransaction: { select: { id: true, paymentCode: true, status: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
    db.ledgerEntry.aggregate({
      where: {
        category: "PACKAGE_REVENUE",
        paymentTransaction: { is: { customerPackage: { is: where } } },
      },
      _sum: { amount: true },
    }),
  ]);

  const summary = metricRows.reduce((result, item) => {
    result.cards += 1;
    result.totalSessions += item.sessionsTotal;
    result.availableSessions += item.sessionsRemaining;
    result.reservedSessions += item.sessionsReserved;
    result.usedSessions += Math.max(0, item.sessionsTotal - item.sessionsRemaining - item.sessionsReserved);
    if (item.status === "ACTIVE") result.activeCards += 1;
    if (item.referrerInput) result.referredCards += 1;
    if (item.paymentTransaction?.status === "PENDING") result.pendingPayments += 1;
    if (item.paymentTransaction?.status === "CONFIRMED") result.confirmedRevenue += item.paymentTransaction.amount;
    result.ownerIds.add(item.customerId);
    return result;
  }, {
    cards: 0,
    activeCards: 0,
    totalSessions: 0,
    availableSessions: 0,
    reservedSessions: 0,
    usedSessions: 0,
    referredCards: 0,
    pendingPayments: 0,
    confirmedRevenue: 0,
    ownerIds: new Set<string>(),
  });

  const perPlanMap = new Map<string, {
    planId: string;
    planName: string;
    cards: number;
    activeCards: number;
    owners: Set<string>;
    availableSessions: number;
    reservedSessions: number;
    usedSessions: number;
    confirmedRevenue: number;
  }>();
  for (const item of metricRows) {
    const current = perPlanMap.get(item.packagePlanId) ?? {
      planId: item.packagePlanId,
      planName: item.planNameSnapshot ?? item.packagePlan.name,
      cards: 0,
      activeCards: 0,
      owners: new Set<string>(),
      availableSessions: 0,
      reservedSessions: 0,
      usedSessions: 0,
      confirmedRevenue: 0,
    };
    current.cards += 1;
    current.activeCards += item.status === "ACTIVE" ? 1 : 0;
    current.owners.add(item.customerId);
    current.availableSessions += item.sessionsRemaining;
    current.reservedSessions += item.sessionsReserved;
    current.usedSessions += Math.max(0, item.sessionsTotal - item.sessionsRemaining - item.sessionsReserved);
    if (item.paymentTransaction?.status === "CONFIRMED") current.confirmedRevenue += item.paymentTransaction.amount;
    perPlanMap.set(item.packagePlanId, current);
  }

  const ledgerRevenue = financialLedger._sum.amount ?? 0;
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    filters: { query, planId: planId || null, status, paymentStatus },
    summary: {
      cards: summary.cards,
      activeCards: summary.activeCards,
      owners: summary.ownerIds.size,
      totalSessions: summary.totalSessions,
      availableSessions: summary.availableSessions,
      reservedSessions: summary.reservedSessions,
      usedSessions: summary.usedSessions,
      referredCards: summary.referredCards,
      pendingPayments: summary.pendingPayments,
      confirmedRevenue: summary.confirmedRevenue,
      financialLedgerRevenue: ledgerRevenue,
      reconciliationDifference: summary.confirmedRevenue - ledgerRevenue,
    },
    perPlan: [...perPlanMap.values()]
      .map((item) => ({ ...item, owners: item.owners.size }))
      .sort((left, right) => right.confirmedRevenue - left.confirmedRevenue || right.cards - left.cards),
    purchases: purchases.map((item) => ({
      ...item,
      expiresAt: item.expiresAt.toISOString(),
      activatedAt: item.activatedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      paymentTransaction: item.paymentTransaction ? {
        ...item.paymentTransaction,
        paidAt: item.paymentTransaction.paidAt?.toISOString() ?? null,
        createdAt: item.paymentTransaction.createdAt.toISOString(),
      } : null,
    })),
    ledger: ledgerRows.map((item) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total: purchaseCount,
      totalPages: Math.max(1, Math.ceil(purchaseCount / pageSize)),
    },
  });
}
