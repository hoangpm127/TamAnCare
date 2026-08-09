import { createHmac } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

loadEnvConfig(process.cwd());

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const WEBHOOK_SECRET = process.env.TEST_SEPAY_WEBHOOK_SECRET ?? process.env.SEPAY_WEBHOOK_SECRET;
const ACCOUNT_NUMBER = process.env.TEST_SEPAY_ACCOUNT_NUMBER
  ?? process.env.SEPAY_ACCOUNT_NUMBERS?.split(",")[0]?.trim();
const QR_SECRET = process.env.TEST_BUSINESS_QR_SECRET ?? process.env.BUSINESS_QR_SECRET ?? process.env.SESSION_SECRET;
const marker = `BIZE2E${Date.now().toString(36).toUpperCase()}`;
const eventCode = `${marker}-OFFICE`;
const customerPhone = `09${String(Date.now()).slice(-8)}`;
const employeePhone = `08${String(Date.now() + 17).slice(-8)}`;
const guestSessionIds = new Set<string>();
const fixtureUserIds: string[] = [];

type CookieJar = Map<string, string>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function updateCookies(response: Response, jar: CookieJar) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.()
    ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (/Max-Age=0/i.test(value) || !cookieValue) jar.delete(name);
    else jar.set(name, cookieValue);
  }
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function jsonRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; jar?: CookieJar } = {},
) {
  const headers: Record<string, string> = { Origin: BASE_URL };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.jar?.size) headers.Cookie = cookieHeader(options.jar);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (options.jar) updateCookies(response, options.jar);
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status}: ${payload.error ?? "Unknown error"}`);
  }
  return payload;
}

function createQrToken(leadTherapistId: string) {
  assert(QR_SECRET, "TEST_BUSINESS_QR_SECRET, BUSINESS_QR_SECRET hoặc SESSION_SECRET chưa được cấu hình cho bài test.");
  const compact = Buffer.from(JSON.stringify({ e: eventCode, t: leadTherapistId, v: 1 })).toString("base64url");
  const signature = createHmac("sha256", QR_SECRET)
    .update(`tam-an-business:${compact}`)
    .digest("base64url");
  return `${compact}.${signature}`;
}

async function sendWebhook(paymentCode: string, amount: number) {
  assert(WEBHOOK_SECRET && ACCOUNT_NUMBER, "Thiếu cấu hình SePay kiểm thử.");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: `${marker}-BALANCE`,
    gateway: "TESTBANK",
    transactionDate: new Date().toISOString(),
    accountNumber: ACCOUNT_NUMBER,
    code: paymentCode,
    content: paymentCode,
    transferType: "in",
    transferAmount: amount,
    referenceCode: `${marker}-BALANCE`,
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
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
  assert(response.ok && payload.success, "Webhook thanh toán Business không được xử lý.");
}

async function cleanup() {
  const event = await db.officeEvent.findUnique({
    where: { eventCode },
    include: {
      payments: { select: { id: true } },
      accessGrants: { select: { guestSessionId: true } },
    },
  });
  if (!event) {
    await db.customer.deleteMany({ where: { phone: { in: [customerPhone, employeePhone] } } });
    if (fixtureUserIds.length) await db.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
    return;
  }
  const paymentIds = event.payments.map((payment) => payment.id);
  event.accessGrants.forEach((grant) => guestSessionIds.add(grant.guestSessionId));
  const paymentGrants = await db.paymentAccessGrant.findMany({
    where: { paymentTransactionId: { in: paymentIds } },
    select: { guestSessionId: true },
  });
  paymentGrants.forEach((grant) => guestSessionIds.add(grant.guestSessionId));

  await db.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: {
        OR: [
          { customerId: event.customerId ?? undefined },
          { actionUrl: { contains: eventCode } },
          { title: { contains: marker } },
          { body: { contains: marker } },
        ],
      },
    });
    await tx.paymentWebhookEvent.deleteMany({
      where: { OR: [{ paymentTransactionId: { in: paymentIds } }, { externalEventId: { contains: marker } }] },
    });
    await tx.tipPayout.deleteMany({ where: { officeEventId: event.id } });
    await tx.ledgerEntry.deleteMany({ where: { officeEventId: event.id } });
    await tx.paymentAccessGrant.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentTransaction.deleteMany({ where: { officeEventId: event.id } });
    await tx.officeRegistration.deleteMany({ where: { eventId: event.id } });
    await tx.businessAccessGrant.deleteMany({ where: { officeEventId: event.id } });
    await tx.officeEvent.delete({ where: { id: event.id } });
    if (event.customerId) await tx.customer.delete({ where: { id: event.customerId } });
    if (guestSessionIds.size) {
      await tx.guestSession.deleteMany({ where: { id: { in: [...guestSessionIds] } } });
    }
    if (fixtureUserIds.length) await tx.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  });
  await db.customer.deleteMany({ where: { phone: employeePhone } });
}

async function main() {
  assert(WEBHOOK_SECRET && ACCOUNT_NUMBER && QR_SECRET, "Thiếu biến môi trường để chạy Business E2E.");
  const branch = await db.branch.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const lead = await db.therapist.findFirstOrThrow({
    where: { branchId: branch.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  const fixturePasswordHash = hashPassword(`Business!${marker}`);
  const owner = await db.user.create({
    data: {
      name: `Owner QA ${marker}`,
      username: `owner_${marker.toLowerCase()}`,
      email: `owner-${marker.toLowerCase()}@business.tests`,
      passwordHash: fixturePasswordHash,
      passwordChangedAt: new Date(),
      role: "OWNER",
    },
  });
  fixtureUserIds.push(owner.id);
  const customer = await db.customer.create({
    data: { fullName: `Khách Business ${marker}`, phone: customerPhone, firstSource: `BUSINESS_E2E:${marker}` },
  });
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const event = await db.officeEvent.create({
    data: {
      branchId: branch.id,
      customerId: customer.id,
      leadTherapistId: lead.id,
      eventCode,
      companyName: `Công ty kiểm thử ${marker}`,
      contactName: customer.fullName,
      contactPhone: customer.phone,
      location: "Tòa nhà kiểm thử Business",
      serviceLabel: "Chăm sóc sức khỏe định kỳ tại văn phòng",
      packageTier: "BUSINESS_E2E",
      headcount: 10,
      durationMin: 20,
      requiredTherapists: 3,
      startsAt,
      endsAt,
      subtotalAmount: 900_000,
      transportFee: 100_000,
      totalAmount: 1_000_000,
      depositAmount: 100_000,
      paidAmount: 100_000,
      paymentStatus: "DEPOSITED",
      status: "READY",
    },
  });
  const depositPayment = await db.paymentTransaction.create({
    data: {
      officeEventId: event.id,
      branchId: branch.id,
      customerId: customer.id,
      type: "DEPOSIT",
      direction: "IN",
      status: "CONFIRMED",
      amount: 100_000,
      receivedAmount: 100_000,
      method: "BUSINESS_E2E",
      paymentCode: `${marker}DEP`,
      idempotencyKey: `${marker}:deposit`,
      paidAt: startsAt,
    },
  });
  await db.ledgerEntry.create({
    data: {
      officeEventId: event.id,
      branchId: branch.id,
      customerId: customer.id,
      paymentTransactionId: depositPayment.id,
      category: "CUSTOMER_DEPOSIT",
      direction: "IN",
      amount: 100_000,
      description: `Cọc Business E2E ${marker}`,
      occurredAt: startsAt,
    },
  });

  const jar: CookieJar = new Map();
  const firstRegistration = await jsonRequest<{ registration: { id: string } }>("/api/office-events/register", {
    jar,
    body: {
      eventCode,
      fullName: `Nhân viên ${marker}`,
      phone: employeePhone,
      slotTime: startsAt.toISOString(),
    },
  });
  const repeatedRegistration = await jsonRequest<{ registration: { id: string } }>("/api/office-events/register", {
    jar,
    body: {
      eventCode,
      fullName: `Nhân viên ${marker}`,
      phone: employeePhone,
      slotTime: startsAt.toISOString(),
    },
  });
  const registrationCount = await db.officeRegistration.count({ where: { eventId: event.id, phone: employeePhone } });
  assert(firstRegistration.registration.id === repeatedRegistration.registration.id && registrationCount === 1, "Đăng ký slot Business chưa idempotent theo số điện thoại.");

  const token = createQrToken(lead.id);
  const scanPath = `/api/business-scan/${encodeURIComponent(token)}`;
  const initial = await jsonRequest<{ event: { status: string; dueAmount: number } }>(scanPath);
  assert(initial.event.status === "READY" && initial.event.dueAmount === 900_000, "QR chưa trả đúng trạng thái READY và công nợ.");

  const started = await jsonRequest<{ status: string }>(scanPath, { jar, body: { action: "START" } });
  assert(started.status === "IN_SERVICE", "QR chưa bắt đầu đồng hồ Business.");
  assert(jar.size > 0, "QR chưa cấp phiên truy cập cho khách không đăng nhập.");

  await jsonRequest(scanPath, { jar, body: { action: "REMIND" } });
  const ended = await jsonRequest<{
    status: string;
    dueAmount: number;
    payment: { id: string; paymentCode: string; amount: number } | null;
  }>(scanPath, { jar, body: { action: "END", bankCode: "TESTBANK" } });
  assert(ended.status === "AWAITING_BALANCE", "Kết thúc ca chưa chuyển sang chờ thanh toán.");
  assert(ended.dueAmount === 900_000 && ended.payment?.amount === 900_000, "Số tiền còn lại không đúng.");
  assert(ended.payment?.paymentCode, "Chưa tạo nội dung chuyển khoản riêng cho Bill Business.");

  await sendWebhook(ended.payment.paymentCode, 900_000);
  const completed = await db.officeEvent.findUniqueOrThrow({
    where: { id: event.id },
    include: { ledgerEntries: true, tipPayout: true, payments: true },
  });
  assert(completed.status === "COMPLETED" && completed.paymentStatus === "PAID", "Bill chưa hoàn tất sau webhook ngân hàng.");
  assert(completed.paidAmount === 1_000_000, "Doanh thu Bill không được giới hạn đúng bằng tổng Bill.");
  assert(completed.sessionsUsed === 1 && completed.actualStartedAt && completed.actualEndedAt, "Thời gian vận hành chưa được lưu đủ.");
  assert(completed.ledgerEntries.some((entry) => entry.category === "SERVICE_REVENUE" && entry.amount === 1_000_000), "Doanh thu Business chưa vào sổ cái.");
  assert(!completed.ledgerEntries.some((entry) => entry.category === "TIP_PAYABLE"), "Tip trực tiếp cho KTV vẫn bị đưa vào sổ Bill Business.");
  assert(!completed.tipPayout, "Tip trực tiếp cho KTV vẫn tạo lịch chi trong hệ thống.");

  const detail = await jsonRequest<{ viewer: string; event: { status: string } }>(
    `/api/business-events/${encodeURIComponent(eventCode)}`,
    { jar },
  );
  assert(detail.viewer === "GUEST" && detail.event.status === "COMPLETED", "Khách quét QR chưa xem được hồ sơ hoàn tất.");
  const review = await jsonRequest<{ persisted: boolean; rating: number }>(
    `/api/business-events/${encodeURIComponent(eventCode)}/review`,
    { jar, body: { rating: 5, comment: `Đánh giá E2E ${marker}` } },
  );
  assert(review.persisted && review.rating === 5, "Đánh giá Business chưa được ghi nhận.");

  const notificationCount = await db.notification.count({ where: { actionUrl: { contains: eventCode } } });
  assert(notificationCount >= 6, "Chuỗi thông báo Business chưa đủ cho khách và quản lý.");

  console.log("BUSINESS_FLOW_OK", JSON.stringify({
    status: completed.status,
    bill: completed.totalAmount,
    deposit: completed.depositAmount,
    balance: ended.dueAmount,
    tipOutsideBill: 0,
    notifications: notificationCount,
  }));
}

main()
  .catch((error) => {
    console.error("BUSINESS_FLOW_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await db.$disconnect();
    }
  });
