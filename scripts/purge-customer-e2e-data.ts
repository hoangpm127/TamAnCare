import { db } from "../lib/db";

const CONFIRMATION = "PURGE_ALL_CUSTOMER_E2E_DATA";

function assertConfirmed() {
  if (process.env.CONFIRM_CUSTOMER_DATA_PURGE !== CONFIRMATION) {
    throw new Error(`Tác vụ bị chặn. Chỉ chạy khi đã đặt CONFIRM_CUSTOMER_DATA_PURGE=${CONFIRMATION}.`);
  }
}

async function main() {
  assertConfirmed();

  const customers = await db.customer.findMany({ select: { id: true } });
  const customerIds = customers.map((item) => item.id);
  const bookings = await db.booking.findMany({ select: { id: true } });
  const bookingIds = bookings.map((item) => item.id);
  const bookingGroups = await db.bookingGroup.findMany({ select: { id: true } });
  const bookingGroupIds = bookingGroups.map((item) => item.id);
  const payments = await db.paymentTransaction.findMany({
    where: {
      OR: [
        { bookingId: { not: null } },
        { bookingGroupId: { not: null } },
        { customerId: { in: customerIds }, officeEventId: null },
      ],
    },
    select: { id: true },
  });
  const paymentIds = payments.map((item) => item.id);
  const affiliateCampaigns = await db.campaign.findMany({
    where: { source: { startsWith: "AFFILIATE:" } },
    select: { id: true },
  });
  const affiliateCampaignIds = affiliateCampaigns.map((item) => item.id);
  const linkedExpenses = await db.ledgerEntry.findMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { bookingGroupId: { in: bookingGroupIds } },
        { paymentTransactionId: { in: paymentIds } },
        { customerId: { in: customerIds }, officeEventId: null },
      ],
    },
    select: { expenseId: true },
  });
  const expenseIds = linkedExpenses.map((item) => item.expenseId).filter((id): id is string => Boolean(id));

  const before = {
    customers: customerIds.length,
    customerAccounts: await db.customerAccount.count(),
    customerSessions: await db.customerSession.count(),
    bookings: bookingIds.length,
    bookingGroups: bookingGroupIds.length,
    voucherUsages: await db.voucherUsage.count(),
    affiliateCampaigns: affiliateCampaignIds.length,
    guestSessions: await db.guestSession.count(),
  };

  await db.$transaction(async (tx) => {
    await tx.consentRecord.deleteMany({});
    await tx.bookingAccessGrant.deleteMany({});
    await tx.paymentAccessGrant.deleteMany({});
    await tx.businessAccessGrant.deleteMany({});
    await tx.refundRequest.deleteMany({
      where: {
        OR: [
          { bookingId: { in: bookingIds } },
          { bookingGroupId: { in: bookingGroupIds } },
          { customerId: { in: customerIds } },
          { sourcePaymentId: { in: paymentIds } },
          { refundPaymentId: { in: paymentIds } },
        ],
      },
    });
    await tx.paymentWebhookEvent.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.tipPayout.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await tx.voucherUsage.deleteMany({});
    await tx.reminder.deleteMany({});
    await tx.review.deleteMany({});
    await tx.notification.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          { type: { in: ["BOOKING", "PAYMENT", "REMINDER", "INVITATION"] } },
        ],
      },
    });
    await tx.ledgerEntry.deleteMany({
      where: {
        OR: [
          { bookingId: { in: bookingIds } },
          { bookingGroupId: { in: bookingGroupIds } },
          { paymentTransactionId: { in: paymentIds } },
          { customerId: { in: customerIds }, officeEventId: null },
        ],
      },
    });
    await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
    await tx.booking.updateMany({ where: { customerPackageId: { not: null } }, data: { customerPackageId: null } });
    await tx.customerPackage.deleteMany({});
    await tx.paymentTransaction.deleteMany({ where: { id: { in: paymentIds } } });
    await tx.booking.deleteMany({});
    await tx.bookingGroup.deleteMany({});
    await tx.customerMonthlyPolicy.deleteMany({});
    await tx.customerSession.deleteMany({});
    await tx.passwordResetChallenge.deleteMany({});
    await tx.phoneOtpChallenge.deleteMany({});
    await tx.customerOAuthIdentity.deleteMany({});
    await tx.customerAccount.deleteMany({});
    await tx.officeRegistration.updateMany({ where: { customerId: { in: customerIds } }, data: { customerId: null } });
    await tx.officeEvent.updateMany({ where: { customerId: { in: customerIds } }, data: { customerId: null } });
    await tx.paymentTransaction.updateMany({ where: { customerId: { in: customerIds } }, data: { customerId: null } });
    await tx.ledgerEntry.updateMany({ where: { customerId: { in: customerIds } }, data: { customerId: null } });
    await tx.guestSession.deleteMany({});
    await tx.campaign.deleteMany({ where: { id: { in: affiliateCampaignIds } } });
    await tx.customer.deleteMany({});
    await tx.rateLimitCounter.deleteMany({});
  });

  const after = {
    customers: await db.customer.count(),
    customerAccounts: await db.customerAccount.count(),
    customerSessions: await db.customerSession.count(),
    bookings: await db.booking.count(),
    bookingGroups: await db.bookingGroup.count(),
    voucherUsages: await db.voucherUsage.count(),
    affiliateCampaigns: await db.campaign.count({ where: { source: { startsWith: "AFFILIATE:" } } }),
    guestSessions: await db.guestSession.count(),
  };

  if (Object.values(after).some((value) => value !== 0)) {
    throw new Error(`Dữ liệu khách chưa được dọn sạch: ${JSON.stringify(after)}`);
  }

  console.log(JSON.stringify({ success: true, before, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
