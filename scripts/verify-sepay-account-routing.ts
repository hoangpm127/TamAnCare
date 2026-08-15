import { createHmac } from "node:crypto";
import { addDays } from "date-fns";
import { db } from "../lib/db";
import {
  accountPurposeMatchesPayment,
  classifySepayAccount,
} from "../lib/server/sepay-payment-routing";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const WEBHOOK_SECRET = process.env.TEST_SEPAY_WEBHOOK_SECRET ?? process.env.SEPAY_WEBHOOK_SECRET;
const PACKAGE_ACCOUNT = process.env.TEST_SEPAY_PACKAGE_ACCOUNT
  ?? process.env.NEXT_PUBLIC_PACKAGE_PAYMENT_ACCOUNT_NUMBER
  ?? "766996789";
const GENERAL_ACCOUNT = process.env.TEST_SEPAY_GENERAL_ACCOUNT
  ?? process.env.SEPAY_ACCOUNT_NUMBERS?.split(",").map((value) => value.trim()).find((value) => value && value !== PACKAGE_ACCOUNT);
const UNKNOWN_ACCOUNT = "000000000000000";
const marker = `SEPAYROUTE${Date.now().toString(36).toUpperCase()}`;
const paymentIds: string[] = [];
let customerId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function sendWebhook(options: {
  eventId: string;
  accountNumber: string;
  paymentCode: string;
  amount: number;
}) {
  assert(WEBHOOK_SECRET, "Thiếu TEST_SEPAY_WEBHOOK_SECRET hoặc SEPAY_WEBHOOK_SECRET.");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: options.eventId,
    gateway: "TESTBANK",
    transactionDate: new Date().toISOString(),
    accountNumber: options.accountNumber,
    code: options.paymentCode,
    content: options.paymentCode,
    transferType: "in",
    transferAmount: options.amount,
    referenceCode: options.eventId,
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${BASE_URL}/api/payments/webhooks/sepay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sepay-timestamp": timestamp,
      "x-sepay-signature": signature,
    },
    body,
  });
  const payload = await response.json().catch(() => ({})) as { success?: boolean };
  assert(response.ok && payload.success, `Webhook ${options.eventId} trả về ${response.status}.`);
}

async function createPayment(options: {
  branchId: string;
  packagePlanId: string;
  label: string;
  amount: number;
  isPackage: boolean;
}) {
  const payment = await db.paymentTransaction.create({
    data: {
      branchId: options.branchId,
      customerId: options.isPackage ? customerId : null,
      type: "SERVICE_PAYMENT",
      direction: "IN",
      status: "PENDING",
      amount: options.amount,
      method: "BANK_TRANSFER_SEPAY",
      paymentCode: `TACS${marker}${options.label}`,
      idempotencyKey: `sepay-routing:${marker}:${options.label}`,
      note: `SePay routing test ${marker}`,
    },
  });
  paymentIds.push(payment.id);

  if (options.isPackage) {
    assert(customerId, "Thiếu khách kiểm thử cho gói dài hạn.");
    await db.customerPackage.create({
      data: {
        customerId,
        packagePlanId: options.packagePlanId,
        paymentTransactionId: payment.id,
        sessionsTotal: 1,
        sessionsRemaining: 1,
        expiresAt: addDays(new Date(), 30),
        status: "PAUSED",
        note: `SePay routing test ${marker}`,
      },
    });
  }

  return payment;
}

async function cleanup() {
  await db.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: {
        OR: [
          ...(customerId ? [{ customerId }] : []),
          { body: { contains: marker } },
        ],
      },
    });
    await tx.packageLedgerEntry.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.ledgerEntry.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentWebhookEvent.deleteMany({
      where: { OR: [{ paymentTransactionId: { in: paymentIds } }, { externalEventId: { contains: marker } }] },
    });
    await tx.customerPackage.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentTransaction.deleteMany({ where: { id: { in: paymentIds } } });
    if (customerId) await tx.customer.delete({ where: { id: customerId } });
  });
}

async function main() {
  assert(GENERAL_ACCOUNT, "Thiếu tài khoản general cho bài test SePay.");
  assert(GENERAL_ACCOUNT !== PACKAGE_ACCOUNT, "Tài khoản general và package phải độc lập.");
  assert(classifySepayAccount(PACKAGE_ACCOUNT) === "PACKAGE", "Tài khoản package chưa được ưu tiên trước allowlist chung.");
  assert(classifySepayAccount(GENERAL_ACCOUNT) === "GENERAL", "Tài khoản general chưa nằm trong allowlist.");
  assert(classifySepayAccount(UNKNOWN_ACCOUNT) === "REVIEW", "Tài khoản lạ không bị đưa vào REVIEW.");
  assert(accountPurposeMatchesPayment("PACKAGE", true), "Quan hệ customerPackage chưa nhận diện payment package.");
  assert(!accountPurposeMatchesPayment("GENERAL", true), "Payment package vẫn khớp sai tài khoản general.");

  const [branch, packagePlan] = await Promise.all([
    db.branch.findFirst({ orderBy: { createdAt: "asc" } }),
    db.packagePlan.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);
  assert(branch && packagePlan, "Thiếu branch hoặc package plan đã seed để kiểm thử.");
  const customer = await db.customer.create({
    data: {
      fullName: `SePay Routing ${marker}`,
      phone: `06${String(Date.now()).slice(-8)}`,
      commonIssues: [],
      firstSource: marker,
    },
  });
  customerId = customer.id;

  const generalSuccess = await createPayment({ branchId: branch.id, packagePlanId: packagePlan.id, label: "GENERALOK", amount: 101_000, isPackage: false });
  const packageSuccess = await createPayment({ branchId: branch.id, packagePlanId: packagePlan.id, label: "PACKAGEOK", amount: 202_000, isPackage: true });
  const packageWrongAccount = await createPayment({ branchId: branch.id, packagePlanId: packagePlan.id, label: "PACKAGEWRONG", amount: 303_000, isPackage: true });
  const generalWrongAccount = await createPayment({ branchId: branch.id, packagePlanId: packagePlan.id, label: "GENERALWRONG", amount: 404_000, isPackage: false });
  const unknownAccount = await createPayment({ branchId: branch.id, packagePlanId: packagePlan.id, label: "UNKNOWN", amount: 505_000, isPackage: false });

  const generalEventId = `${marker}-GENERAL-OK`;
  await sendWebhook({ eventId: generalEventId, accountNumber: GENERAL_ACCOUNT, paymentCode: generalSuccess.paymentCode!, amount: generalSuccess.amount });
  await sendWebhook({ eventId: `${marker}-PACKAGE-OK`, accountNumber: PACKAGE_ACCOUNT, paymentCode: packageSuccess.paymentCode!, amount: packageSuccess.amount });
  await sendWebhook({ eventId: `${marker}-PACKAGE-WRONG`, accountNumber: GENERAL_ACCOUNT, paymentCode: packageWrongAccount.paymentCode!, amount: packageWrongAccount.amount });
  await sendWebhook({ eventId: `${marker}-GENERAL-WRONG`, accountNumber: PACKAGE_ACCOUNT, paymentCode: generalWrongAccount.paymentCode!, amount: generalWrongAccount.amount });
  await sendWebhook({ eventId: `${marker}-UNKNOWN`, accountNumber: UNKNOWN_ACCOUNT, paymentCode: unknownAccount.paymentCode!, amount: unknownAccount.amount });
  await sendWebhook({ eventId: generalEventId, accountNumber: GENERAL_ACCOUNT, paymentCode: generalSuccess.paymentCode!, amount: generalSuccess.amount });

  const [payments, events, duplicateCount, packageRevenueCount, packageActivationCount] = await Promise.all([
    db.paymentTransaction.findMany({ where: { id: { in: paymentIds } }, select: { id: true, status: true } }),
    db.paymentWebhookEvent.findMany({ where: { externalEventId: { contains: marker } }, select: { externalEventId: true, status: true, errorCode: true } }),
    db.paymentWebhookEvent.count({ where: { provider: "SEPAY", externalEventId: generalEventId } }),
    db.ledgerEntry.count({ where: { paymentTransactionId: packageSuccess.id, category: "PACKAGE_REVENUE" } }),
    db.packageLedgerEntry.count({ where: { paymentTransactionId: packageSuccess.id, event: "ACTIVATED" } }),
  ]);
  const statusOf = (id: string) => payments.find((payment) => payment.id === id)?.status;
  const eventOf = (suffix: string) => events.find((event) => event.externalEventId === `${marker}-${suffix}`);

  assert(statusOf(generalSuccess.id) === "CONFIRMED" && eventOf("GENERAL-OK")?.status === "PROCESSED", "General payment + tài khoản general chưa được xử lý.");
  assert(statusOf(packageSuccess.id) === "CONFIRMED" && eventOf("PACKAGE-OK")?.status === "PROCESSED", "Package payment + tài khoản package chưa được xử lý.");
  assert(statusOf(packageWrongAccount.id) === "PENDING" && eventOf("PACKAGE-WRONG")?.errorCode === "PAYMENT_ACCOUNT_PURPOSE_MISMATCH", "Package payment qua tài khoản general đã bị xác nhận nhầm.");
  assert(statusOf(generalWrongAccount.id) === "PENDING" && eventOf("GENERAL-WRONG")?.errorCode === "PAYMENT_ACCOUNT_PURPOSE_MISMATCH", "General payment qua tài khoản package đã bị xác nhận nhầm.");
  assert(statusOf(unknownAccount.id) === "PENDING" && eventOf("UNKNOWN")?.errorCode === "ACCOUNT_MISMATCH", "Tài khoản lạ chưa bị từ chối tự động.");
  assert(duplicateCount === 1, "Webhook trùng đã tạo nhiều PaymentWebhookEvent.");
  assert(packageRevenueCount === 1 && packageActivationCount === 1, "Webhook package trùng đã ghi nhận doanh thu/kích hoạt nhiều lần.");

  console.log("✓ SePay tách biệt general/package, từ chối sai tài khoản và giữ idempotency.");
}

main()
  .then(cleanup)
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await cleanup().catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
