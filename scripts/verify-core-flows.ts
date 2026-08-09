import { createHmac } from "node:crypto";
import { addDays } from "date-fns";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";
import { customerAudienceHeaders } from "../lib/request-audience";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const TEST_WEBHOOK_SECRET = process.env.TEST_SEPAY_WEBHOOK_SECRET ?? "local-e2e-webhook-secret";
const TEST_ACCOUNT_NUMBER = process.env.TEST_SEPAY_ACCOUNT_NUMBER ?? "12346666888";
const marker = `E2E${Date.now().toString(36).toUpperCase()}`;
const testIp = `198.18.${Number(String(Date.now()).slice(-4, -2)) % 250 + 1}.${Number(String(Date.now()).slice(-2)) % 250 + 1}`;
const customerPhone = `09${String(Date.now()).slice(-8)}`;
const guestPhone = `08${String(Date.now() + 1).slice(-8)}`;
const voucherPhone = `07${String(Date.now() + 2).slice(-8)}`;
const customerPin = customerPhone.endsWith("5826") ? "5827" : "5826";
const voucherPin = voucherPhone.endsWith("7395") ? "7396" : "7395";
const adminUsername = `owner_${marker.toLowerCase()}`;
const adminPassword = `Owner!${marker}`;
const receptionUsername = `reception_${marker.toLowerCase()}`;
const receptionPassword = `Reception!${marker}`;
const createdCustomerIds: string[] = [];
const createdGroupIds: string[] = [];
const createdBookingIds: string[] = [];
const createdPaymentIds: string[] = [];
const guestSessionIds = new Set<string>();
const adminUserIds: string[] = [];
let initialBranchAutomationSetting: { id: string; value: string; isActive: boolean } | null = null;
let branchAutomationTouched = false;
let branchAutomationScopeKey = "";

type CookieJar = Map<string, string>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function updateCookies(response: Response, jar: CookieJar) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
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
  options: { method?: string; body?: unknown; jar?: CookieJar; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    "x-forwarded-for": testIp,
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  if (options.jar?.size) headers.Cookie = cookieHeader(options.jar);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  if (options.jar) updateCookies(response, options.jar);
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} → ${response.status}: ${payload.error ?? "Không rõ lỗi"}`);
  return { response, payload };
}

async function availableSlot(serviceId: string, branchId: string) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDays(new Date(), offset).toISOString().slice(0, 10);
    const { payload } = await jsonRequest<{ slots: { startTime: string }[] }>(
      `/api/availability?serviceId=${encodeURIComponent(serviceId)}&branchId=${encodeURIComponent(branchId)}&date=${date}`,
    );
    if (payload.slots?.[0]) return payload.slots[0].startTime;
  }
  throw new Error("Không tìm thấy khung giờ trống để chạy kiểm thử.");
}

async function createBooking(options: {
  referenceCode: string;
  serviceId: string;
  branchId: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  jar: CookieJar;
  voucherCode?: string;
}) {
  const { payload } = await jsonRequest<{ booking: {
    id: string;
    referenceCode: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    depositAmount: number;
    minimumTipAmount: number;
    usedPackage: boolean;
    holdExpiresAt: string | null;
    depositPayment: { id: string; amount: number; paymentCode: string; status: string } | null;
    items: { bookingCode: string }[];
  } }>("/api/booking-groups", {
    jar: options.jar,
    body: {
      referenceCode: options.referenceCode,
      branchId: options.branchId,
      customerName: options.customerName,
      customerPhone: options.customerPhone,
      voucherCode: options.voucherCode,
      relationship: "SELF",
      source: `CORE_TEST:${marker}`,
      acceptTerms: true,
      acceptPrivacy: true,
      acceptBookingPolicy: true,
      units: [{
        bookingCode: `${options.referenceCode}-1`,
        serviceId: options.serviceId,
        startTime: options.startTime,
        source: `CORE_TEST:${marker}`,
      }],
    },
  });
  const group = await db.bookingGroup.findUniqueOrThrow({
    where: { referenceCode: options.referenceCode },
    include: { bookings: true, payments: true, accessGrants: true, consentRecords: true },
  });
  assert(
    group.consentRecords.length === 3
      && group.consentRecords.every((record) => record.granted && record.guestSessionId),
    "Booking online chưa lưu đủ bằng chứng đồng ý gắn với booking và phiên khách.",
  );
  createdGroupIds.push(group.id);
  createdBookingIds.push(...group.bookings.map((item) => item.id));
  createdPaymentIds.push(...group.payments.map((item) => item.id));
  group.accessGrants.forEach((grant) => guestSessionIds.add(grant.guestSessionId));
  return payload.booking;
}

async function updateStatus(referenceCode: string, status: string, jar: CookieJar, venueBranchId?: string, customerAudience = false) {
  const { payload } = await jsonRequest<{ status: string; paymentStatus: string }>(
    `/api/bookings/${encodeURIComponent(referenceCode)}/status`,
    {
      method: "PATCH",
      jar,
      headers: customerAudience ? customerAudienceHeaders : undefined,
      body: { status, actorName: `Core Test ${marker}`, venueBranchId },
    },
  );
  return payload;
}

async function sendWebhook(paymentCode: string, amount: number, eventSuffix: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: `${marker}-${eventSuffix}`,
    gateway: "TESTBANK",
    transactionDate: new Date().toISOString(),
    accountNumber: TEST_ACCOUNT_NUMBER,
    code: paymentCode,
    content: paymentCode,
    transferType: "in",
    transferAmount: amount,
    referenceCode: `${marker}-${eventSuffix}`,
  });
  const signature = createHmac("sha256", TEST_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
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
  assert(response.ok && payload.success, `Webhook ${eventSuffix} không được xử lý.`);
}

async function cleanup() {
  const customers = await db.customer.findMany({
    where: { OR: [{ id: { in: createdCustomerIds } }, { phone: { in: [customerPhone, guestPhone] } }] },
    select: { id: true },
  });
  const customerIds = [...new Set([...createdCustomerIds, ...customers.map((item) => item.id)])];
  const groups = await db.bookingGroup.findMany({
    where: { OR: [{ id: { in: createdGroupIds } }, { referenceCode: { contains: marker } }] },
    include: { bookings: { select: { id: true } }, payments: { select: { id: true } }, accessGrants: { select: { guestSessionId: true } } },
  });
  const groupIds = [...new Set([...createdGroupIds, ...groups.map((item) => item.id)])];
  const bookingIds = [...new Set([...createdBookingIds, ...groups.flatMap((item) => item.bookings.map((booking) => booking.id))])];
  const paymentIds = [...new Set([...createdPaymentIds, ...groups.flatMap((item) => item.payments.map((payment) => payment.id))])];
  groups.flatMap((item) => item.accessGrants).forEach((grant) => guestSessionIds.add(grant.guestSessionId));

  await db.$transaction(async (tx) => {
    await tx.consentRecord.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          { bookingGroupId: { in: groupIds } },
          { guestSessionId: { in: [...guestSessionIds] } },
        ],
      },
    });
    await tx.notification.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          ...(adminUserIds.length ? [{ userId: { in: adminUserIds } }] : []),
          { title: { contains: marker } },
          { body: { contains: marker } },
          { body: { contains: customerPhone } },
          { body: { contains: guestPhone } },
        ],
      },
    });
    await tx.reminder.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.review.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.voucherUsage.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.tipPayout.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await tx.ledgerEntry.deleteMany({
      where: { OR: [{ customerId: { in: customerIds } }, { bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }, { paymentTransactionId: { in: paymentIds } }] },
    });
    await tx.paymentWebhookEvent.deleteMany({
      where: { OR: [{ paymentTransactionId: { in: paymentIds } }, { externalEventId: { contains: marker } }] },
    });
    await tx.paymentAccessGrant.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentTransaction.deleteMany({
      where: { OR: [{ id: { in: paymentIds } }, { customerId: { in: customerIds } }, { bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }] },
    });
    await tx.bookingAccessGrant.deleteMany({ where: { OR: [{ bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.booking.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { groupId: { in: groupIds } }, { customerId: { in: customerIds } }] } });
    await tx.bookingGroup.deleteMany({ where: { OR: [{ id: { in: groupIds } }, { customerId: { in: customerIds } }] } });
    await tx.customerPackage.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customerMonthlyPolicy.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customerAccount.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.campaign.deleteMany({ where: { OR: customerIds.map((id) => ({ source: `AFFILIATE:${id}` })) } });
    await tx.officeRegistration.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    if (adminUserIds.length) {
      await tx.adminAuditLog.deleteMany({ where: { actorUserId: { in: adminUserIds } } });
      await tx.adminSession.deleteMany({ where: { userId: { in: adminUserIds } } });
      await tx.user.deleteMany({ where: { id: { in: adminUserIds } } });
    }
    if (guestSessionIds.size) await tx.guestSession.deleteMany({ where: { id: { in: [...guestSessionIds] } } });
    if (branchAutomationTouched) {
      if (initialBranchAutomationSetting) {
        await tx.systemSetting.update({
          where: { id: initialBranchAutomationSetting.id },
          data: { value: initialBranchAutomationSetting.value, isActive: initialBranchAutomationSetting.isActive },
        });
      } else {
        await tx.systemSetting.deleteMany({ where: { scopeKey: branchAutomationScopeKey } });
      }
    }
  });
}

async function main() {
  const customerJar: CookieJar = new Map();
  const voucherJar: CookieJar = new Map();
  const adminJar: CookieJar = new Map();
  const receptionJar: CookieJar = new Map();
  const guestJar: CookieJar = new Map();
  const branch = await db.branch.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  branchAutomationScopeKey = `${branch.id}:booking.auto_confirm`;
  const service = await db.service.findFirst({
    where: {
      isActive: true,
      isOnline: true,
      durationMin: 60,
      therapists: { some: { branchId: branch.id, status: "ACTIVE", onlineBooking: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  assert(service, "Thiếu dịch vụ 60 phút đủ điều kiện kiểm thử.");

  const missingConsentResponse = await fetch(`${BASE_URL}/api/customer-auth/register`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: `Khách ${marker}`,
      phone: customerPhone,
      pin: customerPin,
    }),
  });
  assert(missingConsentResponse.status === 400, "API đăng ký chưa từ chối yêu cầu thiếu đồng ý bắt buộc.");

  const weakPinResponse = await fetch(`${BASE_URL}/api/customer-auth/register`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: `Khách ${marker}`,
      phone: customerPhone,
      pin: "1234",
      acceptTerms: true,
      acceptPrivacy: true,
    }),
  });
  assert(weakPinResponse.status === 400, "API đăng ký chưa từ chối Mã PIN quá dễ đoán.");

  const registration = await jsonRequest<{ account: { customerId: string } }>("/api/customer-auth/register", {
    jar: customerJar,
    body: {
      fullName: `Khách ${marker}`,
      phone: customerPhone,
      pin: customerPin,
      acceptTerms: true,
      acceptPrivacy: true,
      marketingOptIn: false,
    },
  });
  const customerId = registration.payload.account.customerId;
  createdCustomerIds.push(customerId);
  const registrationConsent = await db.consentRecord.findMany({ where: { customerId, source: "CUSTOMER_REGISTRATION" } });
  assert(
    registrationConsent.length === 3
      && registrationConsent.filter((record) => record.documentType !== "MARKETING").every((record) => record.granted)
      && registrationConsent.find((record) => record.documentType === "MARKETING")?.granted === false,
    "Đăng ký chưa lưu đúng quyết định Điều khoản, Quyền riêng tư và tiếp thị tùy chọn.",
  );
  await jsonRequest("/api/customer-consents", { method: "PATCH", jar: customerJar, body: { marketingOptIn: true } });
  await jsonRequest("/api/customer-consents", { method: "PATCH", jar: customerJar, body: { marketingOptIn: false } });
  const marketingHistory = await db.consentRecord.findMany({
    where: { customerId, documentType: "MARKETING", source: "ACCOUNT_SETTINGS" },
    orderBy: { createdAt: "desc" },
  });
  assert(
    marketingHistory.length === 2
      && marketingHistory[0].granted === false
      && marketingHistory[1].granted
      && Boolean(marketingHistory[1].withdrawnAt),
    "Lựa chọn bật/tắt tiếp thị chưa lưu lịch sử hoặc chưa đánh dấu lần đồng ý trước là đã rút.",
  );

  const plan = await db.packagePlan.findUniqueOrThrow({ where: { id: "pkg-3" } });
  const customerPackage = await db.customerPackage.create({
    data: {
      customerId,
      packagePlanId: plan.id,
      sessionsTotal: 3,
      sessionsRemaining: 3,
      sessionsReserved: 0,
      expiresAt: addDays(new Date(), 45),
      status: "ACTIVE",
      note: `Core flow ${marker}`,
    },
  });

  const admin = await db.user.create({
    data: {
      name: `Owner ${marker}`,
      email: `${adminUsername}@example.test`,
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
      passwordChangedAt: new Date(),
      role: "OWNER",
      isActive: true,
    },
  });
  adminUserIds.push(admin.id);
  await jsonRequest("/api/admin-auth/login", {
    jar: adminJar,
    body: { username: adminUsername, password: adminPassword },
  });
  const reception = await db.user.create({
    data: {
      name: `Lễ tân ${marker}`,
      email: `${receptionUsername}@example.test`,
      username: receptionUsername,
      passwordHash: hashPassword(receptionPassword),
      passwordChangedAt: new Date(),
      role: "RECEPTIONIST",
      branchId: branch.id,
      isActive: true,
    },
  });
  adminUserIds.push(reception.id);
  await jsonRequest("/api/admin-auth/login", {
    jar: receptionJar,
    body: { username: receptionUsername, password: receptionPassword },
  });
  initialBranchAutomationSetting = await db.systemSetting.findUnique({
    where: { scopeKey: `${branch.id}:booking.auto_confirm` },
    select: { id: true, value: true, isActive: true },
  });

  const firstReference = `${marker}-PKGCANCEL`;
  const firstBooking = await createBooking({
    referenceCode: firstReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách ${marker}`,
    customerPhone,
    jar: customerJar,
  });
  assert(firstBooking.usedPackage && firstBooking.totalAmount === 0 && firstBooking.paymentStatus === "PAID" && firstBooking.status === "CONFIRMED", "Booking gói chưa được AI xác nhận ngay.");
  let packageState = await db.customerPackage.findUniqueOrThrow({ where: { id: customerPackage.id } });
  assert(packageState.sessionsRemaining === 2 && packageState.sessionsReserved === 1, "Lượt gói chưa được giữ đúng.");
  await updateStatus(firstReference, "CANCELLED", adminJar);
  packageState = await db.customerPackage.findUniqueOrThrow({ where: { id: customerPackage.id } });
  assert(packageState.sessionsRemaining === 3 && packageState.sessionsReserved === 0, "Hủy booking chưa hoàn lại lượt gói.");

  const secondReference = `${marker}-PKGDONE`;
  const secondBooking = await createBooking({
    referenceCode: secondReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách ${marker}`,
    customerPhone,
    jar: customerJar,
  });
  assert(secondBooking.usedPackage && secondBooking.status === "CONFIRMED", "Booking hoàn tất không dùng lượt gói hoặc chưa được AI xác nhận.");
  assert(secondBooking.minimumTipAmount === 0, "Bill vẫn còn áp mức Tip tối thiểu.");
  await updateStatus(secondReference, "CONFIRMED", adminJar);
  await updateStatus(secondReference, "IN_SERVICE", customerJar, branch.id, true);
  const earlyCheckout = await jsonRequest<{ checkoutRequestedAt: string; dueAmount: number; idempotent: boolean }>(
    `/api/bookings/${encodeURIComponent(secondReference)}/checkout-request`,
    { method: "POST", jar: customerJar },
  );
  assert(earlyCheckout.payload.checkoutRequestedAt && !earlyCheckout.payload.idempotent, "Check-out sớm chưa khóa thời điểm kết thúc thực tế.");
  const repeatedEarlyCheckout = await jsonRequest<{ checkoutRequestedAt: string; idempotent: boolean }>(
    `/api/bookings/${encodeURIComponent(secondReference)}/checkout-request`,
    { method: "POST", jar: customerJar },
  );
  assert(repeatedEarlyCheckout.payload.idempotent, "Yêu cầu check-out sớm lặp lại chưa được xử lý idempotent.");
  const earlyCheckoutGroup = await db.bookingGroup.findUniqueOrThrow({
    where: { referenceCode: secondReference },
    include: { bookings: true },
  });
  assert(
    earlyCheckoutGroup.bookings.every((booking) => booking.checkoutRequestedAt),
    "Check-out sớm chưa đồng bộ thời điểm dừng giờ cho toàn bộ Bill nhóm.",
  );
  const tipInBillResponse = await fetch(`${BASE_URL}/api/payments/checkout-intents`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json", Cookie: cookieHeader(customerJar), "x-forwarded-for": testIp },
    body: JSON.stringify({ bookingCode: secondReference, bankCode: "TESTBANK", tipAmount: 1 }),
  });
  assert(tipInBillResponse.status === 409, "API chưa chặn việc chuyển Tip chung với Bill.");
  const checkout = await jsonRequest<{ paid: boolean; payment: null; dueAmount: number }>("/api/payments/checkout-intents", {
    jar: customerJar,
    body: { bookingCode: secondReference, bankCode: "TESTBANK" },
  });
  assert(checkout.payload.paid && checkout.payload.dueAmount === 0 && checkout.payload.payment === null, "Booking gói 0đ vẫn tạo giao dịch thanh toán không cần thiết.");
  await updateStatus(secondReference, "COMPLETED", adminJar);
  packageState = await db.customerPackage.findUniqueOrThrow({ where: { id: customerPackage.id } });
  assert(packageState.sessionsRemaining === 2 && packageState.sessionsReserved === 0, "Hoàn tất chưa chuyển lượt giữ thành lượt đã dùng.");
  const completedGroup = await db.bookingGroup.findUniqueOrThrow({ where: { referenceCode: secondReference }, include: { bookings: true } });
  const completedBookingId = completedGroup.bookings[0].id;
  const [zeroRevenueCount, tipLedger, tipPayout] = await Promise.all([
    db.ledgerEntry.count({ where: { bookingId: completedBookingId, category: "SERVICE_REVENUE" } }),
    db.ledgerEntry.findFirst({ where: { bookingId: completedBookingId, category: "TIP_PAYABLE" } }),
    db.tipPayout.findUnique({ where: { bookingId: completedBookingId } }),
  ]);
  assert(zeroRevenueCount === 0, "Booking gói đã ghi trùng doanh thu dịch vụ 0đ.");
  assert(!tipLedger && !tipPayout, "Tip trực tiếp cho KTV vẫn bị đưa vào sổ Bill hoặc lịch chi của hệ thống.");

  const voucherReference = `${marker}-WELCOME`;
  const voucherRegistration = await jsonRequest<{ account: { customerId: string } }>("/api/customer-auth/register", {
    jar: voucherJar,
    body: {
      fullName: `Khách mới ${marker}`,
      phone: voucherPhone,
      pin: voucherPin,
      acceptTerms: true,
      acceptPrivacy: true,
      marketingOptIn: false,
    },
  });
  const voucherCustomerId = voucherRegistration.payload.account.customerId;
  createdCustomerIds.push(voucherCustomerId);
  const voucherBooking = await createBooking({
    referenceCode: voucherReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách mới ${marker}`,
    customerPhone: voucherPhone,
    jar: voucherJar,
    voucherCode: "WELCOME150",
  });
  assert(!voucherBooking.usedPackage && voucherBooking.depositPayment?.status === "PENDING", "WELCOME150 không tạo đúng yêu cầu cọc.");
  assert(
    voucherBooking.depositAmount === Math.round((service.basePrice + service.therapistFee) * 0.1),
    "Tiền cọc voucher chưa bằng 10% giá trị Bill ban đầu trước ưu đãi.",
  );
  let account = await db.customerAccount.findUniqueOrThrow({ where: { customerId: voucherCustomerId } });
  let voucherUsage = await db.voucherUsage.findFirstOrThrow({ where: { booking: { group: { referenceCode: voucherReference } } } });
  assert(account.creditBalance === 150_000 && voucherUsage.status === "RESERVED", "Voucher đã bị trừ trước khi đối soát cọc.");
  createdPaymentIds.push(voucherBooking.depositPayment.id);
  await sendWebhook(voucherBooking.depositPayment.paymentCode, voucherBooking.depositPayment.amount, "WELCOME");
  account = await db.customerAccount.findUniqueOrThrow({ where: { customerId: voucherCustomerId } });
  voucherUsage = await db.voucherUsage.findFirstOrThrow({ where: { booking: { group: { referenceCode: voucherReference } } } });
  const welcomeLedger = await db.ledgerEntry.findFirst({ where: { bookingGroup: { referenceCode: voucherReference }, category: "WELCOME_CREDIT" } });
  const voucherGroup = await db.bookingGroup.findUniqueOrThrow({ where: { referenceCode: voucherReference } });
  assert(account.creditBalance === 0 && voucherUsage.status === "CONFIRMED", "Voucher chưa được xác nhận sau webhook.");
  assert(welcomeLedger?.amount === 150_000 && voucherGroup.holdExpiresAt === null && voucherGroup.status === "CONFIRMED", "Quyền lợi WELCOME150 hoặc AI xác nhận lịch chưa được kết sổ.");
  const autoConfirmationNotice = await db.notification.findFirst({
    where: { customerId: voucherCustomerId, title: { contains: "AI xác nhận" }, body: { contains: voucherReference } },
  });
  assert(autoConfirmationNotice?.actionUrl === `/booking/success/${voucherReference}`, "Khách chưa nhận thông báo chúc mừng sau khi AI xác nhận lịch.");
  const venueCheckin = await updateStatus(voucherReference, "IN_SERVICE", voucherJar, branch.id, true);
  assert(
    venueCheckin.status === "IN_SERVICE" && venueCheckin.paymentStatus === "DEPOSITED",
    "Bill đã được AI xác nhận chưa bắt đầu tính giờ sau khi quét đúng QR cơ sở.",
  );
  const venueCheckinNotification = await db.notification.findFirst({
    where: {
      branchId: branch.id,
      title: { contains: "bắt đầu tính giờ qua QR" },
      body: { contains: voucherReference },
    },
  });
  assert(venueCheckinNotification, "Bill bắt đầu tính giờ qua QR chưa báo cho bộ phận vận hành tại cơ sở.");
  const counterCheckout = await jsonRequest<{ serviceRevenue: number; platformRevenue: number; partnerRevenue: number; paymentStatus: string }>(
    "/api/payments/checkout-record",
    {
      jar: receptionJar,
      body: {
        bookingCode: voucherReference,
        actualAmount: voucherBooking.totalAmount - voucherBooking.depositAmount,
        method: "BANK_TRANSFER_MANUAL",
        externalReference: `COUNTER-${marker}`,
        note: "Đã đối soát chuyển khoản tại quầy",
      },
    },
  );
  assert(
    counterCheckout.payload.paymentStatus === "CONFIRMED"
      && counterCheckout.payload.serviceRevenue === voucherBooking.totalAmount
      && counterCheckout.payload.platformRevenue === voucherBooking.depositAmount
      && counterCheckout.payload.partnerRevenue === voucherBooking.totalAmount - voucherBooking.depositAmount,
    "Đối soát tại quầy chưa tách đúng doanh thu Bill, nền tảng và đối tác.",
  );
  await updateStatus(voucherReference, "COMPLETED", adminJar);
  const completedVoucher = await db.bookingGroup.findUniqueOrThrow({
    where: { referenceCode: voucherReference },
    include: { bookings: { include: { ledgerEntries: true } }, payments: true },
  });
  const voucherRevenueEntries = completedVoucher.bookings[0].ledgerEntries.filter((entry) => entry.category === "SERVICE_REVENUE");
  const platformFeeEntries = completedVoucher.bookings[0].ledgerEntries.filter((entry) => entry.category === "PLATFORM_FEE");
  assert(
    completedVoucher.status === "COMPLETED"
      && completedVoucher.paymentStatus === "PAID"
      && voucherRevenueEntries.length === 1
      && voucherRevenueEntries[0].amount === voucherBooking.totalAmount
      && platformFeeEntries.length === 1
      && platformFeeEntries[0].amount === voucherBooking.depositAmount,
    "Một lần xác nhận tại quầy chưa đóng Bill hoặc đang ghi trùng doanh thu/phí nền tảng.",
  );

  branchAutomationTouched = true;
  await jsonRequest("/api/admin-booking-automation", {
    method: "PATCH",
    jar: adminJar,
    body: { branchId: branch.id, mode: "MANUAL" },
  });
  const manualReference = `${marker}-MANUAL`;
  const manualBooking = await createBooking({
    referenceCode: manualReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách vãng lai ${marker}`,
    customerPhone: guestPhone,
    jar: guestJar,
  });
  assert(manualBooking.depositPayment?.status === "PENDING", "Booking thủ công chưa tạo đúng khoản cọc.");
  await sendWebhook(manualBooking.depositPayment.paymentCode, manualBooking.depositPayment.amount, "MANUAL");
  let manualGroup = await db.bookingGroup.findUniqueOrThrow({ where: { referenceCode: manualReference } });
  assert(manualGroup.status === "PENDING" && manualGroup.paymentStatus === "DEPOSITED", "Chế độ thủ công đã tự xác nhận ngoài ý muốn.");
  const manualCheckinResponse = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(manualReference)}/status`, {
    method: "PATCH",
    headers: { Origin: BASE_URL, "Content-Type": "application/json", Cookie: cookieHeader(guestJar), "x-forwarded-for": testIp, ...customerAudienceHeaders },
    body: JSON.stringify({ status: "IN_SERVICE", venueBranchId: branch.id }),
  });
  assert(manualCheckinResponse.status === 409, "Booking ở chế độ thủ công vẫn cho khách check-in trước khi Admin xác nhận.");
  const enabledAutomation = await jsonRequest<{ mode: string; automaticallyConfirmed: number }>("/api/admin-booking-automation", {
    method: "PATCH",
    jar: adminJar,
    body: { branchId: branch.id, mode: "AUTO" },
  });
  manualGroup = await db.bookingGroup.findUniqueOrThrow({ where: { referenceCode: manualReference } });
  assert(enabledAutomation.payload.mode === "AUTO" && enabledAutomation.payload.automaticallyConfirmed >= 1 && manualGroup.status === "CONFIRMED", "Bật AI chưa xử lý các lịch đủ cọc đang chờ.");
  await updateStatus(manualReference, "IN_SERVICE", guestJar, branch.id, true);
  const guestFinance = await jsonRequest<{ entries: { bookingCode?: string; serviceStatus?: string; actualCheckinTime?: string }[]; guestAuthorized: boolean }>(
    "/api/customer-finance",
    { jar: guestJar },
  );
  const guestActiveService = guestFinance.payload.entries.find((entry) => entry.bookingCode === manualReference);
  assert(
    guestFinance.payload.guestAuthorized
      && guestActiveService?.serviceStatus === "IN_SERVICE"
      && Boolean(guestActiveService.actualCheckinTime),
    "Phiên khách vãng lai chưa nhận được ca đang phục vụ để hiển thị đồng hồ trên toàn bộ giao diện khách.",
  );

  const holdReference = `${marker}-EXPIRE`;
  const holdBooking = await createBooking({
    referenceCode: holdReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách vãng lai ${marker}`,
    customerPhone: guestPhone,
    jar: guestJar,
  });
  const guestCustomer = await db.customer.findUniqueOrThrow({ where: { phone: guestPhone } });
  createdCustomerIds.push(guestCustomer.id);
  assert(holdBooking.holdExpiresAt && holdBooking.depositPayment?.status === "PENDING", "Booking thường chưa có giữ chỗ 15 phút.");
  await db.bookingGroup.update({ where: { referenceCode: holdReference }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });
  const expired = await jsonRequest<{ booking: { status: string; depositPayment: { status: string } } }>(
    `/api/booking-groups/${encodeURIComponent(holdReference)}`,
    { jar: guestJar },
  );
  assert(expired.payload.booking.status === "CANCELLED" && expired.payload.booking.depositPayment.status === "VOID", "Booking quá hạn chưa tự hủy và giải phóng thanh toán.");

  const mixedSessionReference = `${marker}-MIXEDROLE`;
  const mixedSessionBooking = await createBooking({
    referenceCode: mixedSessionReference,
    serviceId: service.id,
    branchId: branch.id,
    startTime: await availableSlot(service.id, branch.id),
    customerName: `Khách ${marker}`,
    customerPhone,
    jar: customerJar,
  });
  assert(mixedSessionBooking.status === "CONFIRMED", "Booking kiểm thử phiên kép chưa sẵn sàng check-in.");
  await db.user.update({ where: { id: admin.id }, data: { role: "INVESTOR" } });
  const mixedInvestorCustomerJar: CookieJar = new Map([...customerJar, ...adminJar]);
  const investorPriorityResponse = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(mixedSessionReference)}/status`, {
    method: "PATCH",
    headers: { Origin: BASE_URL, "Content-Type": "application/json", Cookie: cookieHeader(mixedInvestorCustomerJar), "x-forwarded-for": testIp },
    body: JSON.stringify({ status: "IN_SERVICE", venueBranchId: branch.id }),
  });
  assert(investorPriorityResponse.status === 403, "Thiếu bằng chứng hồi quy cho xung đột phiên Nhà đầu tư/Khách.");
  const mixedSessionCheckin = await updateStatus(mixedSessionReference, "IN_SERVICE", mixedInvestorCustomerJar, branch.id, true);
  assert(
    mixedSessionCheckin.status === "IN_SERVICE",
    "Giao diện Khách vẫn bị phiên Nhà đầu tư chặn khi bắt đầu đồng hồ qua QR.",
  );

  console.log(JSON.stringify({
    success: true,
    checks: [
      "package_reserve_and_cancel_restore",
      "package_complete_without_bill_or_tip_transaction",
      "early_checkout_stops_timer_and_is_idempotent",
      "direct_tip_is_optional_and_rejected_from_bill",
      "welcome_voucher_confirmed_only_after_webhook",
      "ai_auto_confirms_paid_booking_and_notifies_customer",
      "manual_mode_waits_for_admin_and_auto_mode_clears_backlog",
      "manual_mode_blocks_customer_checkin_until_confirmation",
      "ai_confirmed_bill_starts_service_with_matching_venue_qr",
      "reception_counter_checkout_closes_bill_and_splits_platform_partner_revenue_once",
      "customer_qr_ignores_investor_session_without_losing_ownership_checks",
      "guest_active_service_is_visible_across_customer_shell",
      "booking_hold_expires_and_voids_payment",
      "versioned_consent_is_required_and_persisted",
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await db.$disconnect();
    }
  });
