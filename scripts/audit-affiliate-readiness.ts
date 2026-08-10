import { db } from "../lib/db";
import { BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "../lib/business-distribution";
import { affiliateCustomerId, affiliateFinancialBreakdown } from "../lib/referral-policy";

async function main() {
  const [campaigns, commissions, guestReferralSessions, businessAffiliates, businessAssets, businessAttributions] = await Promise.all([
    db.campaign.findMany({
      where: { source: { startsWith: "AFFILIATE:" } },
      select: {
        id: true,
        source: true,
        bookings: {
          select: {
            id: true,
            groupId: true,
            customerId: true,
            status: true,
            basePrice: true,
            therapistFee: true,
            totalAmount: true,
            voucherUsages: { select: { status: true, discountAmount: true, voucher: { select: { code: true } } } },
            group: {
              select: {
                subtotalAmount: true,
                totalAmount: true,
                bookings: {
                  select: {
                    voucherUsages: { select: { status: true, discountAmount: true, voucher: { select: { code: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.ledgerEntry.findMany({
      where: { category: "OPERATING_EXPENSE", description: { startsWith: "Hoa hồng Affiliate" } },
      select: { id: true, customerId: true, bookingId: true, bookingGroupId: true, paymentTransactionId: true, amount: true, direction: true, expenseId: true },
    }),
    db.guestSession.findMany({
      where: { referralCampaignId: { not: null } },
      select: {
        referralInstalledAt: true,
        referralExpiresAt: true,
        referralClaimedCustomerId: true,
      },
    }),
    db.businessAffiliate.findMany({
      select: { id: true, status: true, conflictDisclosureRequired: true, conflictDisclosureAcceptedAt: true },
    }),
    db.businessMediaAsset.findMany({
      select: { id: true, status: true, affiliate: { select: { status: true } } },
    }),
    db.businessAttribution.findMany({
      select: { id: true, grossAmount: true, allocations: { select: { recipient: true, amount: true, rateBps: true } } },
    }),
  ]);

  const ownerIds = [...new Set(campaigns.map((campaign) => affiliateCustomerId(campaign.source)).filter((id): id is string => Boolean(id)))];
  const owners = ownerIds.length
    ? await db.customerAccount.findMany({ where: { customerId: { in: ownerIds } }, select: { customerId: true, phoneVerifiedAt: true } })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.customerId, owner]));

  const bookingOwner = new Map<string, { referredCustomerId: string; affiliateCustomerId: string | null; expectedCommission: number }>();
  const financialsByOrder = new Map<string, ReturnType<typeof affiliateFinancialBreakdown>>();
  let selfReferralBookings = 0;
  let trackedBookings = 0;
  for (const campaign of campaigns) {
    const affiliateId = affiliateCustomerId(campaign.source);
    for (const booking of campaign.bookings) {
      trackedBookings += 1;
      const targetId = booking.groupId ?? booking.id;
      const voucherUsages = booking.group?.bookings.flatMap((item) => item.voucherUsages) ?? booking.voucherUsages;
      const financials = affiliateFinancialBreakdown({
        grossBillAmount: booking.group?.subtotalAmount ?? booking.basePrice + booking.therapistFee,
        customerPaymentAmount: booking.group?.totalAmount ?? booking.totalAmount,
        welcomeDiscountAmount: voucherUsages.filter((usage) => usage.status === "CONFIRMED" && usage.voucher.code === "WELCOME150").reduce((sum, usage) => sum + usage.discountAmount, 0),
        affiliateDiscountAmount: voucherUsages.filter((usage) => usage.status === "CONFIRMED" && usage.voucher.code === "AFF50").reduce((sum, usage) => sum + usage.discountAmount, 0),
      });
      financialsByOrder.set(targetId, financials);
      bookingOwner.set(targetId, {
        referredCustomerId: booking.customerId,
        affiliateCustomerId: affiliateId,
        expectedCommission: financials.inviterCommissionAmount,
      });
      if (affiliateId === booking.customerId) selfReferralBookings += 1;
    }
  }

  const rewardsByReferredCustomer = new Map<string, number>();
  let orphanCommissionCount = 0;
  let ownerMismatchCommissionCount = 0;
  let amountMismatchCommissionCount = 0;
  let malformedCommissionCount = 0;
  for (const commission of commissions) {
    const targetId = commission.bookingGroupId ?? commission.bookingId;
    const attribution = targetId ? bookingOwner.get(targetId) : null;
    if (!attribution) {
      orphanCommissionCount += 1;
      continue;
    }
    if (commission.customerId !== attribution.affiliateCustomerId) ownerMismatchCommissionCount += 1;
    if (commission.amount !== attribution.expectedCommission) amountMismatchCommissionCount += 1;
    if (commission.direction !== "OUT" || !commission.expenseId) malformedCommissionCount += 1;
    rewardsByReferredCustomer.set(
      attribution.referredCustomerId,
      (rewardsByReferredCustomer.get(attribution.referredCustomerId) ?? 0) + 1,
    );
  }

  const expectedRecipients = Object.keys(BUSINESS_DISTRIBUTION_RATES) as Array<keyof typeof BUSINESS_DISTRIBUTION_RATES>;
  const invalidBusinessSplits = businessAttributions.filter((attribution) => {
    const recipients = new Map(attribution.allocations.map((allocation) => [allocation.recipient, allocation]));
    const total = attribution.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const expectedAmounts = calculateBusinessDistribution(attribution.grossAmount);
    return attribution.allocations.length !== expectedRecipients.length
      || recipients.size !== expectedRecipients.length
      || expectedRecipients.some((recipient) => {
        const allocation = recipients.get(recipient);
        return !allocation
          || allocation.rateBps !== BUSINESS_DISTRIBUTION_RATES[recipient]
          || allocation.amount !== expectedAmounts[recipient];
      })
      || total !== attribution.grossAmount;
  }).length;

  const report = {
    personalAffiliate: {
      campaignCount: campaigns.length,
      ownerCount: ownerIds.length,
      campaignWithoutAccountOwnerCount: ownerIds.filter((id) => !ownerById.has(id)).length,
      unverifiedOwnerCount: owners.filter((owner) => !owner.phoneVerifiedAt).length,
      referralSessionCount: guestReferralSessions.length,
      pendingReferralSessionCount: guestReferralSessions.filter((session) => !session.referralInstalledAt).length,
      activeReferralSessionCount: guestReferralSessions.filter((session) => Boolean(session.referralInstalledAt)).length,
      claimedReferralSessionCount: guestReferralSessions.filter((session) => Boolean(session.referralClaimedCustomerId)).length,
      expiredReferralSessionCount: guestReferralSessions.filter((session) => Boolean(session.referralExpiresAt && session.referralExpiresAt <= new Date())).length,
      trackedBookingCount: trackedBookings,
      selfReferralBookingCount: selfReferralBookings,
      commissionCount: commissions.length,
      commissionAmount: commissions.reduce((sum, commission) => sum + commission.amount, 0),
      orphanCommissionCount,
      ownerMismatchCommissionCount,
      amountMismatchCommissionCount,
      malformedCommissionCount,
      referredCustomersWithDuplicateCommission: [...rewardsByReferredCustomer.values()].filter((count) => count > 1).length,
      trackedCashFlow: [...financialsByOrder.values()].reduce((totals, item) => ({
        grossBillAmount: totals.grossBillAmount + item.grossBillAmount,
        invitedCustomerBenefitAmount: totals.invitedCustomerBenefitAmount + item.invitedCustomerBenefitAmount,
        customerPaymentAmount: totals.customerPaymentAmount + item.customerPaymentAmount,
        projectedInviterCommissionAmount: totals.projectedInviterCommissionAmount + item.inviterCommissionAmount,
        projectedCenterNetAmount: totals.projectedCenterNetAmount + item.centerNetAmount,
      }), {
        grossBillAmount: 0,
        invitedCustomerBenefitAmount: 0,
        customerPaymentAmount: 0,
        projectedInviterCommissionAmount: 0,
        projectedCenterNetAmount: 0,
      }),
      packageCommissionCount: commissions.filter((commission) => !commission.bookingId && !commission.bookingGroupId && Boolean(commission.paymentTransactionId)).length,
    },
    businessAffiliate: {
      affiliateCount: businessAffiliates.length,
      activeAffiliateMissingDisclosureCount: businessAffiliates.filter((affiliate) => (
        affiliate.status === "ACTIVE"
        && affiliate.conflictDisclosureRequired
        && !affiliate.conflictDisclosureAcceptedAt
      )).length,
      activeAssetWithInactiveAffiliateCount: businessAssets.filter((asset) => asset.status === "ACTIVE" && asset.affiliate && asset.affiliate.status !== "ACTIVE").length,
      attributionCount: businessAttributions.length,
      invalidAllocationSplitCount: invalidBusinessSplits,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error("affiliate.audit_failed", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
