import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { affiliateCustomerId, affiliateOwnerEligible, normalizeAffiliateCode } from "@/lib/referral-policy";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

export const REFERRAL_INSTALL_ATTRIBUTION_DAYS = 30;

type ReferralClient = Prisma.TransactionClient | typeof db;

async function eligibleCampaign(client: ReferralClient, code: string) {
  const normalizedCode = normalizeAffiliateCode(code);
  if (!normalizedCode) return null;
  const campaign = await client.campaign.findFirst({
    where: { code: normalizedCode, source: { startsWith: "AFFILIATE:" } },
  });
  if (!campaign) return null;
  const ownerCustomerId = affiliateCustomerId(campaign.source);
  const owner = ownerCustomerId
    ? await client.customerAccount.findUnique({ where: { customerId: ownerCustomerId }, select: { phoneVerifiedAt: true } })
    : null;
  return affiliateOwnerEligible(owner, phoneVerificationRequired()) ? campaign : null;
}

export async function captureGuestReferral(guestSessionId: string, code: string) {
  const campaign = await eligibleCampaign(db, code);
  if (!campaign) return null;
  const now = new Date();
  const current = await db.guestSession.findUnique({
    where: { id: guestSessionId },
    include: { referralCampaign: true },
  });
  if (!current) return null;

  // Sau khi app đã được cài, nguồn đầu tiên được khóa để tránh ghi đè Affiliate.
  if (current.referralInstalledAt && current.referralExpiresAt && current.referralExpiresAt > now && current.referralCampaign) {
    return {
      state: "ACTIVE" as const,
      code: current.referralCampaign.code,
      expiresAt: current.referralExpiresAt,
    };
  }

  const expiresAt = new Date(now.getTime() + REFERRAL_INSTALL_ATTRIBUTION_DAYS * 86_400_000);
  await db.guestSession.update({
    where: { id: current.id },
    data: {
      referralCampaignId: campaign.id,
      referralCapturedAt: now,
      referralInstalledAt: null,
      referralExpiresAt: expiresAt,
      referralClaimedCustomerId: null,
    },
  });
  return { state: "PENDING" as const, code: campaign.code, expiresAt };
}

export async function activateGuestReferral(input: { guestSessionId: string; code?: string; customerId?: string }) {
  const now = new Date();
  let session = await db.guestSession.findUnique({
    where: { id: input.guestSessionId },
    include: { referralCampaign: true },
  });
  if (!session) return null;

  if ((!session.referralCampaign || !session.referralExpiresAt || session.referralExpiresAt <= now) && input.code) {
    const captured = await captureGuestReferral(input.guestSessionId, input.code);
    if (!captured) return null;
    session = await db.guestSession.findUniqueOrThrow({
      where: { id: input.guestSessionId },
      include: { referralCampaign: true },
    });
  }
  if (!session.referralCampaign || !session.referralExpiresAt || session.referralExpiresAt <= now) return null;
  if (input.code && normalizeAffiliateCode(input.code) !== session.referralCampaign.code) return null;
  if (session.referralClaimedCustomerId && input.customerId && session.referralClaimedCustomerId !== input.customerId) return null;

  const updated = await db.guestSession.update({
    where: { id: session.id },
    data: {
      referralInstalledAt: session.referralInstalledAt ?? now,
      ...(input.customerId && !session.referralClaimedCustomerId ? { referralClaimedCustomerId: input.customerId } : {}),
    },
    include: { referralCampaign: true },
  });
  return {
    state: "ACTIVE" as const,
    code: updated.referralCampaign!.code,
    expiresAt: updated.referralExpiresAt!,
    installedAt: updated.referralInstalledAt!,
  };
}

export async function installedReferralForGuest(guestSessionId: string) {
  const now = new Date();
  const session = await db.guestSession.findUnique({
    where: { id: guestSessionId },
    include: { referralCampaign: true },
  });
  if (!session?.referralCampaign || !session.referralInstalledAt || !session.referralExpiresAt || session.referralExpiresAt <= now) return null;
  const campaign = await eligibleCampaign(db, session.referralCampaign.code);
  if (!campaign || campaign.id !== session.referralCampaign.id) return null;
  return {
    campaignId: campaign.id,
    code: campaign.code,
    claimedCustomerId: session.referralClaimedCustomerId,
  };
}

export async function claimInstalledReferral(
  tx: Prisma.TransactionClient,
  input: { guestSessionId?: string; customerId: string; campaignId: string },
) {
  if (!input.guestSessionId) return false;
  const now = new Date();
  const session = await tx.guestSession.findFirst({
    where: {
      id: input.guestSessionId,
      referralCampaignId: input.campaignId,
      referralInstalledAt: { not: null },
      referralExpiresAt: { gt: now },
    },
  });
  if (!session || (session.referralClaimedCustomerId && session.referralClaimedCustomerId !== input.customerId)) return false;
  if (!session.referralClaimedCustomerId) {
    await tx.guestSession.update({
      where: { id: session.id },
      data: { referralClaimedCustomerId: input.customerId },
    });
  }
  return true;
}
