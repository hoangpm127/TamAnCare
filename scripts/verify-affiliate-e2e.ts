import { createHash, createHmac } from "node:crypto";
import { addDays } from "date-fns";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const TEST_WEBHOOK_SECRET = process.env.TEST_SEPAY_WEBHOOK_SECRET ?? "local-e2e-webhook-secret";
const TEST_ACCOUNT_NUMBER = process.env.TEST_SEPAY_ACCOUNT_NUMBER ?? "12346666888";
const marker = `AFFE2E${Date.now().toString(36).toUpperCase()}`;
const ownerPhone = `09${String(Date.now()).slice(-8)}`;
const friendPhone = `08${String(Date.now() + 1).slice(-8)}`;
const ownerPin = ownerPhone.endsWith("4826") ? "4827" : "4826";
const friendPin = friendPhone.endsWith("7395") ? "7396" : "7395";
const testIp = `198.19.${Number(String(Date.now()).slice(-4, -2)) % 250 + 1}.${Number(String(Date.now()).slice(-2)) % 250 + 1}`;
const referenceCode = `${marker}-BOOKING`;
const ownerUsername = `owner_${marker.toLowerCase()}`;
const ownerPassword = `Owner!${marker}`;
const receptionUsername = `reception_${marker.toLowerCase()}`;
const receptionPassword = `Reception!${marker}`;
let originalAffiliateVoucherStartsAt: Date | null | undefined;

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
  options: { method?: string; body?: unknown; jar?: CookieJar } = {},
) {
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    "x-forwarded-for": testIp,
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
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
  return payload;
}

async function availableSlot(serviceId: string, branchId: string) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDays(new Date(), offset).toISOString().slice(0, 10);
    const result = await jsonRequest<{ slots: { startTime: string }[] }>(
      `/api/availability?serviceId=${encodeURIComponent(serviceId)}&branchId=${encodeURIComponent(branchId)}&date=${date}`,
    );
    if (result.slots?.[0]) return result.slots[0].startTime;
  }
  throw new Error("Không tìm thấy khung giờ trống cho bài test Affiliate.");
}

async function sendWebhook(paymentCode: string, amount: number) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: `${marker}-DEPOSIT`,
    gateway: "TESTBANK",
    transactionDate: new Date().toISOString(),
    accountNumber: TEST_ACCOUNT_NUMBER,
    code: paymentCode,
    content: paymentCode,
    transferType: "in",
    transferAmount: amount,
    referenceCode: `${marker}-DEPOSIT`,
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
  const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
  assert(response.ok && payload.success, `Webhook cọc không thành công: ${payload.error ?? response.status}`);
}

async function updateStatus(reference: string, status: string, jar: CookieJar) {
  return jsonRequest<{ status: string; paymentStatus: string; idempotent?: boolean }>(
    `/api/bookings/${encodeURIComponent(reference)}/status`,
    { method: "PATCH", jar, body: { status, actorName: `Affiliate E2E ${marker}` } },
  );
}

async function cleanup() {
  const customers = await db.customer.findMany({ where: { phone: { in: [ownerPhone, friendPhone] } }, select: { id: true } });
  const customerIds = customers.map((item) => item.id);
  const group = await db.bookingGroup.findUnique({
    where: { referenceCode },
    include: { bookings: { select: { id: true } }, payments: { select: { id: true } }, accessGrants: { select: { guestSessionId: true } } },
  });
  const groupIds = group ? [group.id] : [];
  const bookingIds = group?.bookings.map((item) => item.id) ?? [];
  const paymentIds = group?.payments.map((item) => item.id) ?? [];
  const guestIds = group?.accessGrants.map((item) => item.guestSessionId) ?? [];
  const campaigns = await db.campaign.findMany({ where: { OR: customerIds.map((id) => ({ source: `AFFILIATE:${id}` })) }, select: { id: true } });
  if (campaigns.length) {
    const attributedGuests = await db.guestSession.findMany({ where: { referralCampaignId: { in: campaigns.map((item) => item.id) } }, select: { id: true } });
    guestIds.push(...attributedGuests.map((item) => item.id));
  }
  const users = await db.user.findMany({ where: { username: { in: [ownerUsername, receptionUsername] } }, select: { id: true } });
  const userIds = users.map((item) => item.id);

  await db.$transaction(async (tx) => {
    await tx.consentRecord.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingGroupId: { in: groupIds } }, { guestSessionId: { in: guestIds } }] } });
    await tx.notification.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { userId: { in: userIds } }, { title: { contains: marker } }, { body: { contains: marker } }] } });
    await tx.reminder.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.review.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.voucherUsage.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.tipPayout.deleteMany({ where: { bookingId: { in: bookingIds } } });
    const expenses = await tx.ledgerEntry.findMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }] }, select: { expenseId: true } });
    const expenseIds = expenses.map((item) => item.expenseId).filter((id): id is string => Boolean(id));
    await tx.ledgerEntry.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }, { paymentTransactionId: { in: paymentIds } }] } });
    await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
    await tx.paymentWebhookEvent.deleteMany({ where: { OR: [{ paymentTransactionId: { in: paymentIds } }, { externalEventId: { contains: marker } }] } });
    await tx.paymentAccessGrant.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentTransaction.deleteMany({ where: { OR: [{ id: { in: paymentIds } }, { bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }, { customerId: { in: customerIds } }] } });
    await tx.bookingAccessGrant.deleteMany({ where: { OR: [{ bookingGroupId: { in: groupIds } }, { bookingId: { in: bookingIds } }] } });
    await tx.booking.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { groupId: { in: groupIds } }, { customerId: { in: customerIds } }] } });
    await tx.bookingGroup.deleteMany({ where: { OR: [{ id: { in: groupIds } }, { customerId: { in: customerIds } }] } });
    await tx.customerPackage.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customerMonthlyPolicy.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customerAccount.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.guestSession.deleteMany({ where: { id: { in: guestIds } } });
    await tx.campaign.deleteMany({ where: { id: { in: campaigns.map((item) => item.id) } } });
    await tx.officeRegistration.deleteMany({ where: { customerId: { in: customerIds } } });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    await tx.adminAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tx.adminSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    if (originalAffiliateVoucherStartsAt !== undefined) {
      await tx.voucher.update({ where: { code: "AFF50" }, data: { startsAt: originalAffiliateVoucherStartsAt } });
    }
  });
}

async function main() {
  assert(process.env.APP_ENV !== "production", "Không chạy bài test Affiliate E2E trên production.");
  const ownerJar: CookieJar = new Map();
  const friendJar: CookieJar = new Map();
  const adminJar: CookieJar = new Map();
  const receptionJar: CookieJar = new Map();
  const branch = await db.branch.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const service = await db.service.findUniqueOrThrow({ where: { id: "svc-body-120" } });
  assert(service.isActive && service.isOnline, "Dịch vụ Body Massage 120 phút chưa sẵn sàng đặt online.");
  const grossBillAmount = service.basePrice + service.therapistFee;
  assert(grossBillAmount === 450_000, `Bill kiểm thử cần là 450.000đ, hiện là ${grossBillAmount}.`);

  const ownerRegistration = await jsonRequest<{ account: { customerId: string } }>("/api/customer-auth/register", {
    jar: ownerJar,
    body: { fullName: `Người mời ${marker}`, phone: ownerPhone, pin: ownerPin, acceptTerms: true, acceptPrivacy: true, marketingOptIn: false },
  });
  const ownerSummary = await jsonRequest<{ summary: { code: string; activationRequired: boolean } }>("/api/referrals/summary", { jar: ownerJar });
  assert(!ownerSummary.summary.activationRequired && ownerSummary.summary.code, "Người mời chưa nhận được mã Affiliate sau đăng ký.");
  const campaignCode = ownerSummary.summary.code;
  const competingCampaign = await db.campaign.create({
    data: {
      code: `${marker}ALT`,
      name: `Affiliate cạnh tranh · ${marker}`,
      source: `AFFILIATE:${ownerRegistration.account.customerId}`,
      manualCost: 0,
    },
  });

  const captured = await jsonRequest<{ state: string; code: string }>("/api/referrals/install-attribution", {
    jar: friendJar,
    body: { action: "CAPTURE", code: campaignCode },
  });
  assert(captured.state === "PENDING" && captured.code === campaignCode, "Link Affiliate chưa được ghi nhận trên thiết bị người nhận.");
  const protectedCapture = await jsonRequest<{ state: string; code: string }>("/api/referrals/install-attribution", {
    jar: friendJar,
    body: { action: "CAPTURE", code: competingCampaign.code },
  });
  assert(
    protectedCapture.state === "PENDING" && protectedCapture.code === campaignCode,
    "Nguồn Affiliate đầu tiên bị link mở sau ghi đè trước khi cài app.",
  );
  const activated = await jsonRequest<{ state: string; code: string }>("/api/referrals/install-attribution", {
    jar: friendJar,
    body: { action: "ACTIVATE", code: competingCampaign.code },
  });
  assert(
    activated.state === "ACTIVE" && activated.code === campaignCode,
    "Cài webapp chưa kích hoạt đúng nguồn Affiliate đầu tiên đã được bảo vệ.",
  );

  const friendRegistration = await jsonRequest<{ account: { customerId: string } }>("/api/customer-auth/register", {
    jar: friendJar,
    body: { fullName: `Khách được mời ${marker}`, phone: friendPhone, pin: friendPin, acceptTerms: true, acceptPrivacy: true, marketingOptIn: false },
  });
  const attributedGuests = await db.guestSession.findMany({
    where: { referralInstalledAt: { not: null }, referralCampaign: { code: campaignCode } },
    select: { id: true, referralExpiresAt: true },
  });
  assert(
    attributedGuests.length === 1 && friendJar.has("tt_guest_session_v1"),
    `Phiên cài app Affiliate không còn sau đăng ký (cookies=${[...friendJar.keys()].join(",")}, sessions=${attributedGuests.length}).`,
  );
  const guestToken = friendJar.get("tt_guest_session_v1")!;
  const activeGuest = await db.guestSession.findUnique({
    where: { tokenHash: createHash("sha256").update(guestToken).digest("hex") },
    include: { referralCampaign: true },
  });
  assert(
    activeGuest?.referralCampaign?.code === campaignCode
      && activeGuest.referralInstalledAt
      && activeGuest.referralExpiresAt
      && activeGuest.referralExpiresAt > new Date()
      && activeGuest.referralClaimedCustomerId === friendRegistration.account.customerId,
    "Cookie thiết bị không còn trỏ tới nguồn Affiliate đang hiệu lực.",
  );
  const customerSessionToken = friendJar.get("ta_customer_session_v2");
  assert(customerSessionToken, "Phiên thành viên chưa được tạo sau đăng ký.");
  const recoveredFriendJar: CookieJar = new Map([["ta_customer_session_v2", customerSessionToken]]);
  const startTime = await availableSlot(service.id, branch.id);
  let affiliateVoucher = await db.voucher.findUnique({ where: { code: "AFF50" } });
  if (affiliateVoucher?.startsAt && affiliateVoucher.startsAt > new Date()) {
    // PGlite stores CURRENT_TIMESTAMP without the host timezone offset. Normal
    // PostgreSQL production runs in UTC; normalize only this disposable test DB.
    originalAffiliateVoucherStartsAt = affiliateVoucher.startsAt;
    affiliateVoucher = await db.voucher.update({ where: { code: "AFF50" }, data: { startsAt: new Date(Date.now() - 60_000) } });
  }
  assert(
    affiliateVoucher?.isActive && (!affiliateVoucher.startsAt || affiliateVoucher.startsAt <= new Date()) && (!affiliateVoucher.endsAt || affiliateVoucher.endsAt >= new Date()),
    `AFF50 chưa hoạt động (${JSON.stringify(affiliateVoucher)}).`,
  );
  const voucher = await jsonRequest<{ valid: boolean; code: string; stackedCodes?: string[]; discountAmount: number }>("/api/vouchers/validate", {
    jar: recoveredFriendJar,
    body: { code: "WELCOME150", subtotal: grossBillAmount, serviceIds: [service.id], startTime, customerPhone: friendPhone },
  });
  assert(
    voucher.valid && voucher.discountAmount === 200_000,
    `Ưu đãi WELCOME150 + AFF50 chưa cộng đúng 200.000đ (${JSON.stringify(voucher)}).`,
  );
  assert(voucher.stackedCodes?.join("+") === "WELCOME150+AFF50", "Hai voucher chưa được hiển thị đúng thứ tự.");

  const booking = await jsonRequest<{ booking: {
    id: string;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    depositAmount: number;
    voucherCode: string;
    status: string;
    paymentStatus: string;
    depositPayment: { paymentCode: string; amount: number; status: string } | null;
  } }>("/api/booking-groups", {
    jar: recoveredFriendJar,
    body: {
      referenceCode,
      branchId: branch.id,
      customerName: `Khách được mời ${marker}`,
      customerPhone: friendPhone,
      voucherCode: "WELCOME150",
      campaignCode,
      relationship: "SELF",
      source: `AFFILIATE_E2E:${marker}`,
      bankCode: "TESTBANK",
      acceptTerms: true,
      acceptPrivacy: true,
      acceptBookingPolicy: true,
      units: [{ bookingCode: `${referenceCode}-1`, serviceId: service.id, startTime, source: `AFFILIATE_E2E:${marker}` }],
    },
  });
  assert(booking.booking.subtotalAmount === 450_000, "Bill gốc Affiliate không đúng 450.000đ.");
  assert(booking.booking.discountAmount === 200_000 && booking.booking.totalAmount === 250_000, "Số khách thanh toán sau ưu đãi chưa đúng 250.000đ.");
  assert(booking.booking.depositAmount === 45_000, "Cọc chưa bằng 10% Bill gốc trước ưu đãi.");
  assert(booking.booking.voucherCode === "WELCOME150+AFF50", "Booking chưa lưu đủ hai mã ưu đãi.");
  assert(booking.booking.depositPayment?.status === "PENDING", "Booking chưa tạo yêu cầu cọc SePay.");

  const commissionBeforeDeposit = await db.ledgerEntry.count({
    where: { customerId: ownerRegistration.account.customerId, category: "OPERATING_EXPENSE", bookingGroupId: booking.booking.id },
  });
  assert(commissionBeforeDeposit === 0, "Hoa hồng đã bị cộng trước khi khách thanh toán cọc.");
  await sendWebhook(booking.booking.depositPayment!.paymentCode, booking.booking.depositPayment!.amount);

  const usages = await db.voucherUsage.findMany({
    where: { customerId: friendRegistration.account.customerId, booking: { groupId: booking.booking.id } },
    include: { voucher: { select: { code: true } } },
    orderBy: { discountAmount: "desc" },
  });
  assert(usages.length === 2 && usages.every((item) => item.status === "CONFIRMED"), "Hai voucher chưa được xác nhận sau đối soát cọc.");
  assert(usages.find((item) => item.voucher.code === "WELCOME150")?.discountAmount === 150_000, "WELCOME150 chưa ghi đúng 150.000đ.");
  assert(usages.find((item) => item.voucher.code === "AFF50")?.discountAmount === 50_000, "AFF50 chưa ghi đúng 50.000đ.");

  const ownerUser = await db.user.create({
    data: { name: `Admin ${marker}`, username: ownerUsername, email: `${ownerUsername}@example.test`, passwordHash: hashPassword(ownerPassword), passwordChangedAt: new Date(), role: "OWNER", isActive: true },
  });
  const receptionUser = await db.user.create({
    data: { name: `Lễ tân ${marker}`, username: receptionUsername, email: `${receptionUsername}@example.test`, passwordHash: hashPassword(receptionPassword), passwordChangedAt: new Date(), role: "RECEPTIONIST", branchId: branch.id, isActive: true },
  });
  assert(ownerUser.id && receptionUser.id, "Không tạo được tài khoản vận hành cho bài test.");
  await jsonRequest("/api/admin-auth/login", { jar: adminJar, body: { username: ownerUsername, password: ownerPassword } });
  await jsonRequest("/api/admin-auth/login", { jar: receptionJar, body: { username: receptionUsername, password: receptionPassword } });
  await updateStatus(referenceCode, "CONFIRMED", adminJar);
  await updateStatus(referenceCode, "CHECKED_IN", receptionJar);
  await updateStatus(referenceCode, "IN_SERVICE", receptionJar);

  await jsonRequest("/api/payments/checkout-record", {
    jar: receptionJar,
    body: {
      bookingCode: referenceCode,
      actualAmount: 205_000,
      method: "BANK_TRANSFER_MANUAL",
      externalReference: `COUNTER-${marker}`,
      note: "Đã đối soát phần còn lại tại quầy; không bao gồm Tip.",
    },
  });
  const commissionBeforeCompletion = await db.ledgerEntry.count({
    where: { customerId: ownerRegistration.account.customerId, category: "OPERATING_EXPENSE", bookingGroupId: booking.booking.id },
  });
  assert(commissionBeforeCompletion === 0, "Hoa hồng đã bị cộng trước khi dịch vụ hoàn tất.");

  const completed = await updateStatus(referenceCode, "COMPLETED", receptionJar);
  assert(completed.status === "COMPLETED" && completed.paymentStatus === "PAID", "Lễ tân chưa thể hoàn tất Bill đã thanh toán đủ.");
  const idempotentCompletion = await updateStatus(referenceCode, "COMPLETED", receptionJar);
  assert(idempotentCompletion.idempotent, "Thao tác hoàn tất lặp lại chưa idempotent.");

  const commissions = await db.ledgerEntry.findMany({
    where: { customerId: ownerRegistration.account.customerId, category: "OPERATING_EXPENSE", bookingGroupId: booking.booking.id, description: { startsWith: "Hoa hồng Affiliate" } },
  });
  assert(commissions.length === 1 && commissions[0].amount === 25_000, "Hoa hồng người mời chưa đúng 10% của 250.000đ hoặc bị ghi trùng.");
  const serviceRevenue = await db.ledgerEntry.aggregate({
    where: { bookingGroupId: booking.booking.id, category: "SERVICE_REVENUE" },
    _sum: { amount: true },
  });
  assert(serviceRevenue._sum.amount === 250_000, "Doanh thu dịch vụ sau ưu đãi chưa đúng 250.000đ.");
  const tipEntries = await db.ledgerEntry.count({ where: { bookingGroupId: booking.booking.id, category: "TIP_PAYABLE" } });
  assert(tipEntries === 0, "Tip đã bị đưa vào Bill/GMV dù khách không khai báo Tip.");

  const finalSummary = await jsonRequest<{ summary: {
    totalEarned: number;
    invited: { status: string; reward: number; orders: Array<{ grossBillAmount: number; invitedCustomerBenefitAmount: number; amount: number; commission: number; centerNetAmount: number }> }[];
  } }>("/api/referrals/summary", { jar: ownerJar });
  const invited = finalSummary.summary.invited.find((item) => item.orders.some((order) => order.grossBillAmount === 450_000));
  const order = invited?.orders[0];
  assert(invited?.status === "COMPLETED" && invited.reward === 25_000, "Ví Affiliate chưa ghi nhận đúng đơn hoàn tất.");
  assert(order?.invitedCustomerBenefitAmount === 200_000 && order.amount === 250_000 && order.commission === 25_000 && order.centerNetAmount === 225_000, "Giao diện Affiliate chưa khớp dòng tiền ba bên 450K/200K/250K/25K/225K.");
  assert(finalSummary.summary.totalEarned === 25_000, "Tổng thu nhập Affiliate chưa đúng 25.000đ.");

  console.log(JSON.stringify({
    success: true,
    checks: [
      "first_referral_is_locked_before_install_and_cannot_be_overwritten",
      "installed_referral_recovers_from_customer_account_without_original_guest_cookie",
      "new_member_receives_welcome150_plus_aff50",
      "deposit_is_ten_percent_of_original_bill",
      "commission_is_not_recorded_before_full_payment_and_completion",
      "reception_controls_checkin_service_checkout_and_completion",
      "affiliate_commission_is_ten_percent_of_customer_payment_once",
      "three_party_cash_flow_is_450k_200k_250k_25k_225k",
      "tip_stays_outside_bill_and_gmv",
      "affiliate_summary_matches_ledger",
    ],
    amounts: { grossBill: 450_000, invitedBenefit: 200_000, customerPaid: 250_000, inviterCommission: 25_000, centerNet: 225_000, tip: 0 },
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
