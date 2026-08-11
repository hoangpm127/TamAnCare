import "server-only";

import type { PackageLedgerEvent, Prisma } from "@/app/generated/prisma/client";
import { affiliateCustomerId, normalizeAffiliateCode } from "@/lib/referral-policy";
import { isVietnamMobilePhone, normalizeVietnamPhone } from "@/lib/server/phone-otp";

type TransactionClient = Prisma.TransactionClient;

export class PackageReferralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageReferralError";
  }
}

export type ResolvedPackageReferrer = {
  input: string | null;
  campaignId: string | null;
  customerId: string | null;
  name: string | null;
  phone: string | null;
};

export async function resolvePackageReferrer(
  tx: TransactionClient,
  rawValue: string | null | undefined,
  buyerCustomerId: string,
): Promise<ResolvedPackageReferrer> {
  const input = rawValue?.trim().replace(/\s+/g, " ").slice(0, 120) || null;
  if (!input) return { input: null, campaignId: null, customerId: null, name: null, phone: null };

  const affiliateCode = normalizeAffiliateCode(input);
  const campaign = affiliateCode
    ? await tx.campaign.findFirst({
        where: { code: { equals: affiliateCode, mode: "insensitive" }, source: { startsWith: "AFFILIATE:" } },
        select: { id: true, source: true },
      })
    : null;
  const campaignCustomerId = affiliateCustomerId(campaign?.source);

  let customer = campaignCustomerId
    ? await tx.customer.findUnique({ where: { id: campaignCustomerId }, select: { id: true, fullName: true, phone: true } })
    : null;

  if (!customer && isVietnamMobilePhone(input)) {
    customer = await tx.customer.findUnique({
      where: { phone: normalizeVietnamPhone(input) },
      select: { id: true, fullName: true, phone: true },
    });
  }

  if (!customer && !campaign) {
    const exactNames = await tx.customer.findMany({
      where: { fullName: { equals: input, mode: "insensitive" } },
      select: { id: true, fullName: true, phone: true },
      take: 2,
    });
    if (exactNames.length === 1) customer = exactNames[0];
  }

  if (customer?.id === buyerCustomerId || campaignCustomerId === buyerCustomerId) {
    throw new PackageReferralError("Người giới thiệu cần là một khách hàng khác.");
  }

  return {
    input,
    campaignId: campaign?.id ?? null,
    customerId: customer?.id ?? null,
    name: customer?.fullName ?? (campaign ? input : null),
    phone: customer?.phone ?? (isVietnamMobilePhone(input) ? normalizeVietnamPhone(input) : null),
  };
}

export async function recordPackageLedger(
  tx: TransactionClient,
  input: {
    customerPackageId: string;
    packagePlanId: string;
    customerId: string;
    branchId?: string | null;
    paymentTransactionId?: string | null;
    bookingId?: string | null;
    bookingGroupId?: string | null;
    event: PackageLedgerEvent;
    availableDelta?: number;
    reservedDelta?: number;
    usedDelta?: number;
    amount?: number;
    description: string;
    metadata?: Prisma.InputJsonValue;
    idempotencyKey: string;
    occurredAt?: Date;
  },
) {
  return tx.packageLedgerEntry.createMany({
    data: [{
      customerPackageId: input.customerPackageId,
      packagePlanId: input.packagePlanId,
      customerId: input.customerId,
      branchId: input.branchId ?? null,
      paymentTransactionId: input.paymentTransactionId ?? null,
      bookingId: input.bookingId ?? null,
      bookingGroupId: input.bookingGroupId ?? null,
      event: input.event,
      availableDelta: input.availableDelta ?? 0,
      reservedDelta: input.reservedDelta ?? 0,
      usedDelta: input.usedDelta ?? 0,
      amount: input.amount ?? 0,
      description: input.description,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt ?? new Date(),
    }],
    skipDuplicates: true,
  });
}
