import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const marker = `REFUND${Date.now().toString(36).toUpperCase()}`;
const managerPassword = `Manager!${marker}`;
const ownerPassword = `Owner!${marker}`;
const customerPassword = `Customer!${marker}`;
const customerPhone = `07${String(Date.now()).slice(-8)}`;
const managerJar = new Map<string, string>();
const ownerJar = new Map<string, string>();
const customerJar = new Map<string, string>();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function updateCookies(response: Response, jar: Map<string, string>) {
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

async function request<T>(path: string, options: { method?: string; body?: unknown; jar?: Map<string, string> } = {}) {
  const headers: Record<string, string> = { Origin: BASE_URL };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.jar?.size) headers.Cookie = [...options.jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  if (options.jar) updateCookies(response, options.jar);
  const payload = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  return { response, payload };
}

async function cleanup() {
  const users = await db.user.findMany({ where: { username: { contains: marker.toLowerCase() } }, select: { id: true } });
  const userIds = users.map((item) => item.id);
  const customer = await db.customer.findUnique({ where: { phone: customerPhone }, select: { id: true } });
  const group = await db.bookingGroup.findUnique({ where: { referenceCode: marker }, include: { bookings: true, payments: true } });
  const paymentIds = group?.payments.map((item) => item.id) ?? [];
  const bookingIds = group?.bookings.map((item) => item.id) ?? [];
  await db.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, ...(customer ? [{ customerId: customer.id }] : []), { body: { contains: marker } }] } });
    await tx.adminAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tx.refundRequest.deleteMany({ where: { OR: [{ sourcePaymentId: { in: paymentIds } }, { refundPaymentId: { in: paymentIds } }] } });
    await tx.tipPayout.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await tx.ledgerEntry.deleteMany({ where: { OR: [{ paymentTransactionId: { in: paymentIds } }, { bookingId: { in: bookingIds } }, ...(customer ? [{ customerId: customer.id }] : [])] } });
    await tx.paymentWebhookEvent.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentAccessGrant.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
    await tx.paymentTransaction.deleteMany({ where: { OR: [{ id: { in: paymentIds } }, { idempotencyKey: { contains: marker } }] } });
    await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    if (group) await tx.bookingGroup.delete({ where: { id: group.id } });
    if (customer) {
      await tx.customerSession.deleteMany({ where: { customerId: customer.id } });
      await tx.passwordResetChallenge.deleteMany({ where: { customerId: customer.id } });
      await tx.customerAccount.deleteMany({ where: { customerId: customer.id } });
      await tx.customer.delete({ where: { id: customer.id } });
    }
    await tx.adminSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}

async function main() {
  await cleanup();
  const [branch, service] = await Promise.all([
    db.branch.findFirst({ orderBy: { id: "asc" } }),
    db.service.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
  ]);
  assert(branch && service, "Cần seed cơ sở và dịch vụ trước khi kiểm thử hoàn tiền.");
  const now = new Date();
  const endTime = new Date(now.getTime() + 60 * 60_000);

  const fixture = await db.$transaction(async (tx) => {
    const manager = await tx.user.create({
      data: { name: `Manager ${marker}`, username: `manager_${marker.toLowerCase()}`, email: `${marker.toLowerCase()}-manager@tests.local`, passwordHash: hashPassword(managerPassword), passwordChangedAt: now, role: "MANAGER", branchId: branch.id },
    });
    const owner = await tx.user.create({
      data: { name: `Owner ${marker}`, username: `owner_${marker.toLowerCase()}`, email: `${marker.toLowerCase()}-owner@tests.local`, passwordHash: hashPassword(ownerPassword), passwordChangedAt: now, role: "OWNER" },
    });
    const customer = await tx.customer.create({
      data: { fullName: `Khách ${marker}`, phone: customerPhone, commonIssues: [], totalSpend: 250_000, totalVisits: 1, segment: "RETURNING" },
    });
    await tx.customerAccount.create({ data: { customerId: customer.id, phone: customerPhone, passwordHash: hashPassword(customerPassword), creditBalance: 0 } });
    const group = await tx.bookingGroup.create({
      data: { referenceCode: marker, branchId: branch.id, customerId: customer.id, subtotalAmount: 250_000, totalAmount: 250_000, depositAmount: 0, paidAmount: 250_000, status: "COMPLETED", paymentStatus: "PAID" },
    });
    const booking = await tx.booking.create({
      data: { bookingCode: `${marker}-1`, branchId: branch.id, customerId: customer.id, serviceId: service.id, groupId: group.id, startTime: now, endTime, durationMin: 60, basePrice: 250_000, totalAmount: 250_000, paidAmount: 250_000, tipAmount: 150_000, status: "COMPLETED", paymentStatus: "PAID", completedAt: now },
    });
    const source = await tx.paymentTransaction.create({
      data: { bookingGroupId: group.id, branchId: branch.id, customerId: customer.id, type: "SERVICE_PAYMENT", direction: "IN", status: "CONFIRMED", amount: 250_000, receivedAmount: 400_000, method: "BANK_TRANSFER_SEPAY", paymentCode: `${marker}PAY`, externalReference: `${marker}:SERVICE`, idempotencyKey: `${marker}:service`, paidAt: now, note: "Bill 250.000đ; khách chuyển 400.000đ" },
    });
    const tip = await tx.paymentTransaction.create({
      data: { bookingGroupId: group.id, branchId: branch.id, customerId: customer.id, type: "TIP", direction: "IN", status: "CONFIRMED", amount: 150_000, receivedAmount: 150_000, method: "BANK_TRANSFER_SEPAY", externalReference: `${marker}:TIP`, idempotencyKey: `${marker}:tip`, paidAt: now, note: "Tip KTV ngoài Bill" },
    });
    await tx.ledgerEntry.createMany({ data: [
      { branchId: branch.id, customerId: customer.id, bookingGroupId: group.id, bookingId: booking.id, paymentTransactionId: source.id, category: "SERVICE_REVENUE", direction: "IN", amount: 250_000, description: `${marker} doanh thu dịch vụ`, occurredAt: now },
      { branchId: branch.id, customerId: customer.id, bookingGroupId: group.id, bookingId: booking.id, paymentTransactionId: tip.id, category: "TIP_PAYABLE", direction: "IN", amount: 150_000, description: `${marker} Tip KTV ngoài Bill`, occurredAt: now },
    ] });
    return { manager, owner, customer, group, booking, source, tip };
  });

  try {
    const managerLogin = await request<{ account?: { id: string } }>("/api/admin-auth/login", { jar: managerJar, body: { username: fixture.manager.username, password: managerPassword } });
    assert(managerLogin.response.ok && managerLogin.payload.account?.id === fixture.manager.id, "Quản lý không đăng nhập được.");
    const ownerLogin = await request<{ account?: { id: string } }>("/api/admin-auth/login", { jar: ownerJar, body: { username: fixture.owner.username, password: ownerPassword } });
    assert(ownerLogin.response.ok && ownerLogin.payload.account?.id === fixture.owner.id, "Chủ không đăng nhập được.");

    const baselineFinance = await request<{ serviceRevenue: number; refunds: number; tips: number }>("/api/finance/summary", { jar: ownerJar });
    assert(baselineFinance.response.ok, "Không đọc được báo cáo tài chính ban đầu.");

    const overLimit = await request("/api/refunds", { jar: managerJar, body: { sourcePaymentId: fixture.source.id, amount: 400_000, reason: "Kiểm thử không được hoàn cả phần Tip KTV" } });
    assert(overLimit.response.status === 409 && overLimit.payload.code === "AMOUNT_EXCEEDED", "Hệ thống chưa chặn hoàn lấn sang Tip KTV.");

    const created = await request<{ refund: { id: string } }>("/api/refunds", { jar: managerJar, body: { sourcePaymentId: fixture.source.id, amount: 250_000, reason: "Khách đủ điều kiện hoàn toàn bộ tiền dịch vụ" } });
    assert(created.response.status === 201 && created.payload.refund?.id, "Không lập được yêu cầu hoàn tiền.");
    const refundId = created.payload.refund.id;

    const managerApprove = await request(`/api/refunds/${refundId}`, { method: "PATCH", jar: managerJar, body: { action: "APPROVE", note: "Quản lý tự duyệt" } });
    assert(managerApprove.response.status === 403, "Quản lý không được có quyền phê duyệt hoàn tiền.");

    const approved = await request(`/api/refunds/${refundId}`, { method: "PATCH", jar: ownerJar, body: { action: "APPROVE", note: "Đã đối chiếu chính sách và khoản thu gốc" } });
    assert(approved.response.ok, "Chủ không phê duyệt được yêu cầu hợp lệ.");
    const bankReference = `${marker}-BANK-01`;
    const completed = await request(`/api/refunds/${refundId}`, { method: "PATCH", jar: ownerJar, body: { action: "COMPLETE", bankReference } });
    assert(completed.response.ok, "Không ghi nhận được giao dịch ngân hàng hoàn tiền.");

    const refund = await db.refundRequest.findUniqueOrThrow({ where: { id: refundId }, include: { refundPayment: true } });
    const [source, tip, group, booking, customer, refundLedger] = await Promise.all([
      db.paymentTransaction.findUniqueOrThrow({ where: { id: fixture.source.id } }),
      db.paymentTransaction.findUniqueOrThrow({ where: { id: fixture.tip.id } }),
      db.bookingGroup.findUniqueOrThrow({ where: { id: fixture.group.id } }),
      db.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }),
      db.customer.findUniqueOrThrow({ where: { id: fixture.customer.id } }),
      db.ledgerEntry.findFirst({ where: { category: "REFUND", paymentTransactionId: refund.refundPaymentId } }),
    ]);
    assert(refund.status === "COMPLETED" && refund.bankReference === bankReference && refund.refundPayment?.status === "CONFIRMED", "Trạng thái hoàn tiền chưa khớp giao dịch ngân hàng.");
    assert(source.status === "REFUNDED", "Giao dịch dịch vụ gốc chưa chuyển sang REFUNDED.");
    assert(tip.status === "CONFIRMED" && tip.amount === 150_000, "Tip KTV đã bị thay đổi khi hoàn Bill dịch vụ.");
    assert(group.paymentStatus === "REFUNDED" && group.paidAmount === 0 && booking.paymentStatus === "REFUNDED", "Bill chưa được tính lại sau hoàn tiền.");
    assert(customer.totalSpend === 0, "CRM chưa đảo giảm tổng chi tiêu sau hoàn tiền.");
    assert(refundLedger?.amount === 250_000 && refundLedger.direction === "OUT", "Sổ cái chưa có bút toán hoàn tiền OUT.");

    const afterFinance = await request<{ serviceRevenue: number; refunds: number; tips: number }>("/api/finance/summary", { jar: ownerJar });
    assert(afterFinance.response.ok, "Không đọc được báo cáo tài chính sau hoàn.");
    assert(afterFinance.payload.refunds - baselineFinance.payload.refunds === 250_000, "Báo cáo chưa cộng đúng khoản hoàn.");
    assert(afterFinance.payload.serviceRevenue === baselineFinance.payload.serviceRevenue - 250_000, "Doanh thu thuần chưa đảo giảm đúng số tiền hoàn.");
    assert(afterFinance.payload.tips === baselineFinance.payload.tips, "Tip KTV không được thay đổi bởi hoàn tiền dịch vụ.");

    const customerLogin = await request<{ account?: { customerId: string } }>("/api/customer-auth/login", { jar: customerJar, body: { phone: customerPhone, password: customerPassword } });
    assert(customerLogin.response.ok, "Khách kiểm thử không đăng nhập được.");
    const wallet = await request<{ entries: Array<{ paymentStatus?: string; amount: number; note?: string }> }>("/api/customer-finance", { jar: customerJar });
    const refundEntry = wallet.payload.entries.find((item) => item.paymentStatus === "REFUND");
    assert(wallet.response.ok && refundEntry?.amount === -250_000 && refundEntry.note?.includes(bankReference), "Ví khách chưa hiển thị khoản hoàn và mã ngân hàng.");

    console.log("✓ Chặn hoàn vượt tiền dịch vụ, không đụng Tip KTV");
    console.log("✓ Quản lý lập · Chủ duyệt · mã ngân hàng mới hạch toán");
    console.log("✓ Bill, CRM, sổ cái, báo cáo và Ví khách đã nối logic sau hoàn");
  } finally {
    await cleanup();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
