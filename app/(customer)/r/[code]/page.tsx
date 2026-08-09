import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { affiliateCustomerId, affiliateOwnerEligible, normalizeAffiliateCode } from "@/lib/referral-policy";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";
import { ReferralLandingClient } from "./referral-landing-client";

export const dynamic = "force-dynamic";

export default async function ReferralLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = normalizeAffiliateCode(code);
  if (!normalizedCode) notFound();
  const now = new Date();
  const [campaign, voucher] = await Promise.all([
    db.campaign.findFirst({ where: { code: normalizedCode, source: { startsWith: "AFFILIATE:" } } }),
    db.voucher.findFirst({
      where: {
        code: "AFF50",
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { code: true, discountValue: true, minimumSpend: true, minimumServiceDurationMin: true, displayConstraint: true },
    }),
  ]);
  if (!campaign) notFound();
  const ownerCustomerId = affiliateCustomerId(campaign.source);
  const owner = ownerCustomerId
    ? await db.customerAccount.findUnique({ where: { customerId: ownerCustomerId }, select: { phoneVerifiedAt: true } })
    : null;
  if (!affiliateOwnerEligible(owner, phoneVerificationRequired())) notFound();
  return <ReferralLandingClient code={campaign.code} offer={voucher} />;
}
