import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

const CONFIRMATION = "RESET_TAMAN_PRODUCTION_LAUNCH_DATA_V1";
const ADMIN_LOGIN = "admin@tamancare.io";
const RECEPTION_LOGIN = "letan@tamancare.io";

function assertProductionTarget() {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "production") {
    throw new Error("Blocked: this operation may only run in the Railway production environment.");
  }
  if (process.env.RAILWAY_PROJECT_NAME !== "TamAnCare" || process.env.RAILWAY_SERVICE_NAME !== "TamAnCare") {
    throw new Error("Blocked: Railway project/service does not match TamAnCare/TamAnCare.");
  }
}

function requiredSecret(name: "RESET_ADMIN_PASSWORD" | "RESET_RECEPTION_PASSWORD") {
  const value = process.env[name];
  if (!value || value.length < 8) throw new Error(`Blocked: ${name} must contain at least 8 characters.`);
  return value;
}

async function fixedDataSnapshot() {
  const [branches, services, therapists, therapistSchedules, rooms, vouchers, packagePlans, systemSettings, businessDistricts, investmentOpportunities, investmentOpportunityChecks, investorBenefits, retainedCampaigns] = await Promise.all([
    db.branch.count(),
    db.service.count(),
    db.therapist.count(),
    db.therapistWeeklySchedule.count(),
    db.room.count(),
    db.voucher.count(),
    db.packagePlan.count(),
    db.systemSetting.count(),
    db.businessDistrict.count(),
    db.investmentOpportunity.count(),
    db.investmentOpportunityCheck.count(),
    db.investorBenefit.count(),
    db.campaign.count({ where: { NOT: { source: { startsWith: "AFFILIATE:" } } } }),
  ]);

  return {
    branches,
    services,
    therapists,
    therapistSchedules,
    rooms,
    vouchers,
    packagePlans,
    systemSettings,
    businessDistricts,
    investmentOpportunities,
    investmentOpportunityChecks,
    investorBenefits,
    retainedCampaigns,
  };
}

async function transientDataSnapshot() {
  const [
    users,
    customers,
    customerAccounts,
    customerOAuthIdentities,
    customerSessions,
    passwordResetChallenges,
    phoneOtpChallenges,
    customerMonthlyPolicies,
    affiliateCampaigns,
    guestSessions,
    consentRecords,
    bookingAccessGrants,
    paymentAccessGrants,
    businessAccessGrants,
    bookings,
    bookingGroups,
    payments,
    refunds,
    paymentWebhookEvents,
    ledgerEntries,
    expenses,
    expenseEvidence,
    tipPayouts,
    voucherUsages,
    customerPackages,
    reminders,
    reviews,
    notifications,
    officeEvents,
    officeRegistrations,
    businessAffiliates,
    businessMediaAssets,
    businessLeads,
    businessAttributions,
    businessAllocations,
    investorProfiles,
    investorAllocations,
    investorDistributions,
    adminSessions,
    adminAuditLogs,
    mfaRecoveryCodes,
    rateLimitCounters,
  ] = await Promise.all([
    db.user.count(),
    db.customer.count(),
    db.customerAccount.count(),
    db.customerOAuthIdentity.count(),
    db.customerSession.count(),
    db.passwordResetChallenge.count(),
    db.phoneOtpChallenge.count(),
    db.customerMonthlyPolicy.count(),
    db.campaign.count({ where: { source: { startsWith: "AFFILIATE:" } } }),
    db.guestSession.count(),
    db.consentRecord.count(),
    db.bookingAccessGrant.count(),
    db.paymentAccessGrant.count(),
    db.businessAccessGrant.count(),
    db.booking.count(),
    db.bookingGroup.count(),
    db.paymentTransaction.count(),
    db.refundRequest.count(),
    db.paymentWebhookEvent.count(),
    db.ledgerEntry.count(),
    db.expense.count(),
    db.expenseEvidence.count(),
    db.tipPayout.count(),
    db.voucherUsage.count(),
    db.customerPackage.count(),
    db.reminder.count(),
    db.review.count(),
    db.notification.count(),
    db.officeEvent.count(),
    db.officeRegistration.count(),
    db.businessAffiliate.count(),
    db.businessMediaAsset.count(),
    db.businessLead.count(),
    db.businessAttribution.count(),
    db.businessAllocation.count(),
    db.investorProfile.count(),
    db.investorAllocation.count(),
    db.investorDistribution.count(),
    db.adminSession.count(),
    db.adminAuditLog.count(),
    db.mfaRecoveryCode.count(),
    db.rateLimitCounter.count(),
  ]);

  return {
    users,
    customers,
    customerAccounts,
    customerOAuthIdentities,
    customerSessions,
    passwordResetChallenges,
    phoneOtpChallenges,
    customerMonthlyPolicies,
    affiliateCampaigns,
    guestSessions,
    consentRecords,
    bookingAccessGrants,
    paymentAccessGrants,
    businessAccessGrants,
    bookings,
    bookingGroups,
    payments,
    refunds,
    paymentWebhookEvents,
    ledgerEntries,
    expenses,
    expenseEvidence,
    tipPayouts,
    voucherUsages,
    customerPackages,
    reminders,
    reviews,
    notifications,
    officeEvents,
    officeRegistrations,
    businessAffiliates,
    businessMediaAssets,
    businessLeads,
    businessAttributions,
    businessAllocations,
    investorProfiles,
    investorAllocations,
    investorDistributions,
    adminSessions,
    adminAuditLogs,
    mfaRecoveryCodes,
    rateLimitCounters,
  };
}

function equalSnapshots(left: Record<string, number>, right: Record<string, number>) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

async function main() {
  assertProductionTarget();

  const branches = await db.branch.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, address: true },
  });
  if (!branches.length) throw new Error("Blocked: production has no branch for the receptionist account.");

  const requestedBranchId = process.env.RESET_RECEPTION_BRANCH_ID?.trim();
  const receptionBranch = requestedBranchId
    ? branches.find((branch) => branch.id === requestedBranchId)
    : branches.find((branch) => branch.name.toLocaleLowerCase("vi").includes("tây hồ")) ?? branches[0];
  if (!receptionBranch) throw new Error("Blocked: RESET_RECEPTION_BRANCH_ID does not match a production branch.");

  const before = {
    fixed: await fixedDataSnapshot(),
    transient: await transientDataSnapshot(),
  };

  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify({
      mode: "DRY_RUN",
      target: {
        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
        project: process.env.RAILWAY_PROJECT_NAME,
        service: process.env.RAILWAY_SERVICE_NAME,
      },
      receptionBranch,
      availableBranches: branches,
      before,
      note: "No data changed. Use --execute with the confirmation and password environment variables.",
    }, null, 2));
    return;
  }

  if (process.env.CONFIRM_PRODUCTION_LAUNCH_RESET !== CONFIRMATION) {
    throw new Error(`Blocked: set CONFIRM_PRODUCTION_LAUNCH_RESET=${CONFIRMATION} to execute.`);
  }

  const adminPasswordHash = hashPassword(requiredSecret("RESET_ADMIN_PASSWORD"));
  const receptionPasswordHash = hashPassword(requiredSecret("RESET_RECEPTION_PASSWORD"));
  const passwordChangedAt = new Date();

  await db.$transaction(async (tx) => {
    const affiliateCampaigns = await tx.campaign.findMany({
      where: { source: { startsWith: "AFFILIATE:" } },
      select: { id: true },
    });
    const affiliateCampaignIds = affiliateCampaigns.map((campaign) => campaign.id);

    await tx.businessAllocation.deleteMany({});
    await tx.businessAttribution.deleteMany({});
    await tx.businessLead.deleteMany({});
    await tx.businessMediaAsset.deleteMany({});
    await tx.businessAffiliate.deleteMany({});

    await tx.consentRecord.deleteMany({});
    await tx.bookingAccessGrant.deleteMany({});
    await tx.paymentAccessGrant.deleteMany({});
    await tx.businessAccessGrant.deleteMany({});
    await tx.refundRequest.deleteMany({});
    await tx.paymentWebhookEvent.deleteMany({});
    await tx.adminAuditLog.deleteMany({});
    await tx.ledgerEntry.deleteMany({});
    await tx.tipPayout.deleteMany({});
    await tx.voucherUsage.deleteMany({});
    await tx.review.deleteMany({});
    await tx.reminder.deleteMany({});
    await tx.notification.deleteMany({});

    await tx.booking.updateMany({
      where: { customerPackageId: { not: null } },
      data: { customerPackageId: null },
    });
    await tx.customerPackage.updateMany({
      where: { paymentTransactionId: { not: null } },
      data: { paymentTransactionId: null },
    });
    await tx.customerPackage.deleteMany({});
    await tx.paymentTransaction.deleteMany({});
    await tx.booking.deleteMany({});
    await tx.bookingGroup.deleteMany({});

    await tx.officeRegistration.deleteMany({});
    await tx.officeEvent.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.expenseEvidence.deleteMany({});

    await tx.customerMonthlyPolicy.deleteMany({});
    await tx.customerSession.deleteMany({});
    await tx.passwordResetChallenge.deleteMany({});
    await tx.phoneOtpChallenge.deleteMany({});
    await tx.customerOAuthIdentity.deleteMany({});
    await tx.customerAccount.deleteMany({});
    await tx.guestSession.deleteMany({});
    await tx.customer.deleteMany({});

    if (affiliateCampaignIds.length) {
      await tx.voucher.updateMany({
        where: { campaignId: { in: affiliateCampaignIds } },
        data: { campaignId: null },
      });
      await tx.campaign.deleteMany({ where: { id: { in: affiliateCampaignIds } } });
    }

    await tx.investorDistribution.deleteMany({});
    await tx.investorAllocation.deleteMany({});
    await tx.investorProfile.deleteMany({});
    await tx.adminSession.deleteMany({});
    await tx.mfaRecoveryCode.deleteMany({});
    await tx.rateLimitCounter.deleteMany({});
    await tx.investmentOpportunity.updateMany({
      where: { createdByUserId: { not: null } },
      data: { createdByUserId: null },
    });
    await tx.businessDistrict.updateMany({
      where: { managerUserId: { not: null } },
      data: { managerUserId: null },
    });
    await tx.user.deleteMany({});

    await tx.user.createMany({
      data: [
        {
          name: "Admin Tâm An Center",
          email: ADMIN_LOGIN,
          username: ADMIN_LOGIN,
          passwordHash: adminPasswordHash,
          passwordChangedAt,
          role: "OWNER",
          isActive: true,
        },
        {
          name: "Lễ tân Tâm An Center",
          email: RECEPTION_LOGIN,
          username: RECEPTION_LOGIN,
          passwordHash: receptionPasswordHash,
          passwordChangedAt,
          role: "RECEPTIONIST",
          branchId: receptionBranch.id,
          isActive: true,
        },
      ],
    });
  }, { maxWait: 15_000, timeout: 120_000 });

  const [fixedAfter, transientAfter, usersAfter] = await Promise.all([
    fixedDataSnapshot(),
    transientDataSnapshot(),
    db.user.findMany({
      orderBy: { email: "asc" },
      select: {
        email: true,
        username: true,
        role: true,
        branchId: true,
        isActive: true,
        passwordChangedAt: true,
      },
    }),
  ]);

  if (!equalSnapshots(before.fixed, fixedAfter)) {
    throw new Error(`Fixed data changed unexpectedly: ${JSON.stringify({ before: before.fixed, after: fixedAfter })}`);
  }

  const remainingTransient = Object.entries(transientAfter)
    .filter(([key, value]) => key !== "users" && value !== 0);
  if (remainingTransient.length) {
    throw new Error(`Transient data remains: ${JSON.stringify(Object.fromEntries(remainingTransient))}`);
  }

  if (
    usersAfter.length !== 2
    || transientAfter.users !== 2
    || usersAfter.some((user) => !user.isActive || !user.passwordChangedAt)
    || !usersAfter.some((user) => user.username === ADMIN_LOGIN && user.role === "OWNER" && user.branchId === null)
    || !usersAfter.some((user) => user.username === RECEPTION_LOGIN && user.role === "RECEPTIONIST" && user.branchId === receptionBranch.id)
  ) {
    throw new Error(`Seeded account verification failed: ${JSON.stringify(usersAfter)}`);
  }

  console.log(JSON.stringify({
    success: true,
    mode: "EXECUTED",
    receptionBranch,
    before,
    after: { fixed: fixedAfter, transient: transientAfter, users: usersAfter },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
