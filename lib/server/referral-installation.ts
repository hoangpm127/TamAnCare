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

  // First-touch attribution: a valid invitation is protected immediately,
  // rather than waiting until the webapp installation has finished.
  if (current.referralExpiresAt && current.referralExpiresAt > now && current.referralCampaign) {
    return {
      state: current.referralInstalledAt ? "ACTIVE" as const : "PENDING" as const,
      code: current.referralCampaign.code,
      expiresAt: current.referralExpiresAt,
    };
  }

  const expiresAt = new Date(now.getTime() + REFERRAL_INSTALL_ATTRIBUTION_DAYS * 86_400_000);
  // The conditional update makes the first capture atomic when multiple tabs
  // or invitation links race on the same device.
  await db.guestSession.updateMany({
    where: {
      id: current.id,
      OR: [
        { referralCampaignId: null },
        { referralExpiresAt: null },
        { referralExpiresAt: { lte: now } },
      ],
    },
    data: {
      referralCampaignId: campaign.id,
      referralCapturedAt: now,
      referralInstalledAt: null,
      referralExpiresAt: expiresAt,
      referralClaimedCustomerId: null,
    },
  });
  const captured = await db.guestSession.findUnique({
    where: { id: current.id },
    include: { referralCampaign: true },
  });
  if (!captured?.referralCampaign || !captured.referralExpiresAt || captured.referralExpiresAt <= now) return null;
  return {
    state: captured.referralInstalledAt ? "ACTIVE" as const : "PENDING" as const,
    code: captured.referralCampaign.code,
    expiresAt: captured.referralExpiresAt,
  };
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
  // The protected server-side first touch is authoritative if local browser
  // storage still contains a later or stale invitation code.
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

export async function bindInstalledReferralToCustomer(guestSessionId: string, customerId: string) {
  const now = new Date();
  const result = await db.guestSession.updateMany({
    where: {
      id: guestSessionId,
      referralCampaignId: { not: null },
      referralInstalledAt: { not: null },
      referralExpiresAt: { gt: now },
      OR: [
        { referralClaimedCustomerId: null },
        { referralClaimedCustomerId: customerId },
      ],
    },
    data: { referralClaimedCustomerId: customerId },
  });
  return result.count === 1;
}

export async function installedReferralForCustomer(customerId: string) {
  const now = new Date();
  const session = await db.guestSession.findFirst({
    where: {
      referralClaimedCustomerId: customerId,
      referralInstalledAt: { not: null },
      referralExpiresAt: { gt: now },
    },
    include: { referralCampaign: true },
    orderBy: { referralInstalledAt: "asc" },
  });
  if (!session?.referralCampaign || !session.referralExpiresAt) return null;
  const campaign = await eligibleCampaign(db, session.referralCampaign.code);
  if (!campaign || campaign.id !== session.referralCampaign.id) return null;
  return {
    campaignId: campaign.id,
    code: campaign.code,
    claimedCustomerId: customerId,
  };
}

export async function installedReferralForIdentity(input: { guestSessionId?: string; customerId?: string }) {
  const guestReferral = input.guestSessionId
    ? await installedReferralForGuest(input.guestSessionId)
    : null;
  if (guestReferral && (!guestReferral.claimedCustomerId || guestReferral.claimedCustomerId === input.customerId)) {
    return guestReferral;
  }
  return input.customerId ? installedReferralForCustomer(input.customerId) : null;
}

export async function claimInstalledReferral(
  tx: Prisma.TransactionClient,
  input: { guestSessionId?: string; customerId: string; campaignId: string },
) {
  const now = new Date();
  const session = await tx.guestSession.findFirst({
    where: {
      referralCampaignId: input.campaignId,
      referralInstalledAt: { not: null },
      referralExpiresAt: { gt: now },
      OR: [
        ...(input.guestSessionId ? [{ id: input.guestSessionId }] : []),
        { referralClaimedCustomerId: input.customerId },
      ],
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
