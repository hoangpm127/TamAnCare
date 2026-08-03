import { createHmac } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

loadEnvConfig(process.cwd());

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const marker = `SEC${Date.now().toString(36).toUpperCase()}`;
const customerPhone = `05${String(Date.now()).slice(-8)}`;
const unknownPhone = `06${String(Date.now() + 1).slice(-8)}`;
const customerPassword = `Customer!${marker}Old`;
const newCustomerPassword = `Customer!${marker}New`;
const ownerPassword = `Owner!${marker}Secure`;
const resetCode = "24681357";
const requestIp = `10.250.${Number(String(Date.now()).slice(-4, -2))}.${Number(String(Date.now()).slice(-2)) || 1}`;
const customerJar = new Map<string, string>();
const ownerJar = new Map<string, string>();

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
  const headers: Record<string, string> = { Origin: BASE_URL, "X-Forwarded-For": requestIp };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.jar?.size) headers.Cookie = [...options.jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  if (options.jar) updateCookies(response, options.jar);
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  return { response, payload };
}

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of input.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}

function privateDigest(value: string) {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SESSION_SECRET ?? "tam-an-local-rate-limit-secret";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function rateKey(scope: string, identifier: string) {
  return `${scope}:${privateDigest(identifier)}`;
}

function passwordResetHash(challengeId: string, phoneHash: string, code: string) {
  const secret = process.env.SESSION_SECRET ?? "tam-an-local-password-recovery-secret";
  return createHmac("sha256", secret).update(`${challengeId}:${phoneHash}:${code}`).digest("hex");
}

async function cleanup() {
  const owner = await db.user.findUnique({ where: { username: `owner_${marker.toLowerCase()}` }, select: { id: true } });
  const customer = await db.customer.findUnique({ where: { phone: customerPhone }, select: { id: true } });
  await db.$transaction(async (tx) => {
    if (owner) {
      await tx.notification.deleteMany({ where: { userId: owner.id } });
      await tx.adminAuditLog.deleteMany({ where: { actorUserId: owner.id } });
      await tx.adminSession.deleteMany({ where: { userId: owner.id } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: owner.id } });
      await tx.user.delete({ where: { id: owner.id } });
    }
    if (customer) {
      await tx.notification.deleteMany({ where: { customerId: customer.id } });
      await tx.customerSession.deleteMany({ where: { customerId: customer.id } });
      await tx.passwordResetChallenge.deleteMany({ where: { OR: [{ customerId: customer.id }, { phoneHash: privateDigest(customerPhone) }] } });
      await tx.customerAccount.deleteMany({ where: { customerId: customer.id } });
      await tx.customer.delete({ where: { id: customer.id } });
    }
    await tx.passwordResetChallenge.deleteMany({ where: { phoneHash: privateDigest(unknownPhone) } });
    const accountIdentifiers = [customerPhone, unknownPhone].map((phone) => `${requestIp}:${phone}`);
    const ownerId = owner?.id ?? "missing";
    const keys = [
      rateKey("customer-reset-request-ip", requestIp),
      rateKey("customer-reset-confirm-ip", requestIp),
      rateKey("customer-login-ip", requestIp),
      rateKey("admin-login-ip", requestIp),
      ...[customerPhone, unknownPhone].flatMap((phone) => [
        rateKey("customer-reset-request-phone", phone),
        rateKey("customer-reset-confirm-phone", phone),
      ]),
      ...accountIdentifiers.map((identifier) => rateKey("customer-login-account", identifier)),
      rateKey("admin-login-account", `${requestIp}:owner_${marker.toLowerCase()}`),
      rateKey("admin-mfa-setup", `${requestIp}:${ownerId}`),
      rateKey("admin-mfa-confirm", `${requestIp}:${ownerId}`),
      rateKey("admin-mfa-disable", `${requestIp}:${ownerId}`),
    ];
    await tx.rateLimitCounter.deleteMany({ where: { key: { in: keys } } });
  });
}

async function main() {
  await cleanup();
  const now = new Date();
  const customer = await db.customer.create({ data: { fullName: `Khách bảo mật ${marker}`, phone: customerPhone, commonIssues: [] } });
  await db.customerAccount.create({ data: { customerId: customer.id, phone: customerPhone, passwordHash: hashPassword(customerPassword), creditBalance: 0 } });
  const owner = await db.user.create({
    data: { name: `Owner bảo mật ${marker}`, username: `owner_${marker.toLowerCase()}`, email: `${marker.toLowerCase()}@security.tests`, role: "OWNER", passwordHash: hashPassword(ownerPassword), passwordChangedAt: now },
  });

  try {
    const initialCustomerLogin = await request<{ account?: { customerId: string } }>("/api/customer-auth/login", { jar: customerJar, body: { phone: customerPhone, password: customerPassword } });
    assert(initialCustomerLogin.response.ok && initialCustomerLogin.payload.account?.customerId === customer.id, "Không tạo được phiên khách trước khi reset.");
    assert(await db.customerSession.count({ where: { customerId: customer.id } }) > 0, "Phiên khách kiểm thử chưa được lưu.");

    const existingReset = await request<{ accepted: boolean; deliveryConfigured: boolean; message: string }>("/api/customer-auth/password-reset/request", { body: { phone: customerPhone } });
    const unknownReset = await request<{ accepted: boolean; deliveryConfigured: boolean; message: string }>("/api/customer-auth/password-reset/request", { body: { phone: unknownPhone } });
    assert(existingReset.response.status === 202 && unknownReset.response.status === 202, "Endpoint reset không trả phản hồi đồng nhất.");
    assert(JSON.stringify(existingReset.payload) === JSON.stringify(unknownReset.payload), "Phản hồi reset đang làm lộ số điện thoại có tài khoản.");

    const challenge = await db.passwordResetChallenge.findFirstOrThrow({ where: { customerId: customer.id, consumedAt: null }, orderBy: { createdAt: "desc" } });
    await db.passwordResetChallenge.update({ where: { id: challenge.id }, data: { codeHash: passwordResetHash(challenge.id, challenge.phoneHash, resetCode) } });
    const reset = await request<{ reset: boolean; sessionsRevoked: boolean }>("/api/customer-auth/password-reset/confirm", { body: { phone: customerPhone, code: resetCode, newPassword: newCustomerPassword } });
    assert(reset.response.ok && reset.payload.reset && reset.payload.sessionsRevoked, "Không đặt lại được mật khẩu hợp lệ.");
    assert(await db.customerSession.count({ where: { customerId: customer.id } }) === 0, "Reset mật khẩu chưa thu hồi tất cả phiên cũ.");
    const staleSession = await request<{ account: unknown }>("/api/customer-auth/session", { jar: customerJar });
    assert(staleSession.response.ok && staleSession.payload.account === null, "Cookie phiên cũ vẫn truy cập được sau reset.");
    const reuse = await request("/api/customer-auth/password-reset/confirm", { body: { phone: customerPhone, code: resetCode, newPassword: `${newCustomerPassword}2` } });
    assert(reuse.response.status === 400, "Mã reset đã dùng vẫn có thể dùng lại.");
    const oldLogin = await request("/api/customer-auth/login", { body: { phone: customerPhone, password: customerPassword } });
    assert(oldLogin.response.status === 401, "Mật khẩu cũ vẫn đăng nhập được sau reset.");
    const newLogin = await request<{ account?: { customerId: string } }>("/api/customer-auth/login", { body: { phone: customerPhone, password: newCustomerPassword } });
    assert(newLogin.response.ok && newLogin.payload.account?.customerId === customer.id, "Mật khẩu mới không đăng nhập được.");

    const ownerLogin = await request<{ account?: { id: string } }>("/api/admin-auth/login", { jar: ownerJar, body: { username: owner.username, password: ownerPassword } });
    assert(ownerLogin.response.ok && ownerLogin.payload.account?.id === owner.id, "Chủ kiểm thử không đăng nhập được.");
    const setup = await request<{ manualKey: string; provisioningUri: string }>("/api/admin-auth/mfa", { jar: ownerJar, body: { currentPassword: ownerPassword } });
    assert(setup.response.ok && /^[A-Z2-7]+$/.test(setup.payload.manualKey), "Không bắt đầu được thiết lập TOTP.");
    assert(setup.payload.provisioningUri.startsWith("otpauth://totp/"), "Thiếu provisioning URI chuẩn cho Authenticator.");
    const currentCounter = Math.floor(Date.now() / 1000 / 30);
    const enabled = await request<{ recoveryCodes: string[] }>("/api/admin-auth/mfa", { method: "PATCH", jar: ownerJar, body: { code: totp(setup.payload.manualKey, currentCounter) } });
    assert(enabled.response.ok && enabled.payload.recoveryCodes.length === 10, "Không bật được MFA hoặc thiếu mã khôi phục.");
    const securedUser = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    assert(Boolean(securedUser.mfaEnabledAt) && securedUser.totpSecretEncrypted?.startsWith("v1:") && !securedUser.totpSecretEncrypted.includes(setup.payload.manualKey), "TOTP secret chưa được mã hóa an toàn trong CSDL.");

    const mfaPromptJar = new Map<string, string>();
    const prompt = await request<{ mfaRequired?: boolean }>("/api/admin-auth/login", { jar: mfaPromptJar, body: { username: owner.username, password: ownerPassword } });
    assert(prompt.response.ok && prompt.payload.mfaRequired === true && mfaPromptJar.size === 0, "Đăng nhập quản trị chưa yêu cầu yếu tố thứ hai.");
    const nextCounterCode = totp(setup.payload.manualKey, currentCounter + 1);
    const mfaJar = new Map<string, string>();
    const mfaLogin = await request<{ account?: { id: string } }>("/api/admin-auth/login", { jar: mfaJar, body: { username: owner.username, password: ownerPassword, mfaCode: nextCounterCode } });
    assert(mfaLogin.response.ok && mfaLogin.payload.account?.id === owner.id, "TOTP hợp lệ không đăng nhập được.");
    const replay = await request("/api/admin-auth/login", { body: { username: owner.username, password: ownerPassword, mfaCode: nextCounterCode } });
    assert(replay.response.status === 401, "TOTP đã dùng vẫn bị chấp nhận lại.");

    const firstRecoveryCode = enabled.payload.recoveryCodes[0];
    const recoveryLogin = await request<{ account?: { id: string } }>("/api/admin-auth/login", { body: { username: owner.username, password: ownerPassword, mfaCode: firstRecoveryCode } });
    assert(recoveryLogin.response.ok && recoveryLogin.payload.account?.id === owner.id, "Mã khôi phục hợp lệ không đăng nhập được.");
    const recoveryReuse = await request("/api/admin-auth/login", { body: { username: owner.username, password: ownerPassword, mfaCode: firstRecoveryCode } });
    assert(recoveryReuse.response.status === 401, "Mã khôi phục đã dùng vẫn có thể dùng lại.");
    assert(await db.mfaRecoveryCode.count({ where: { userId: owner.id, consumedAt: { not: null } } }) === 1, "Trạng thái tiêu thụ mã khôi phục chưa chính xác.");

    console.log("✓ Khôi phục mật khẩu không lộ tài khoản, mã dùng một lần và thu hồi phiên cũ");
    console.log("✓ TOTP được mã hóa, chống phát lại và bắt buộc ở lần đăng nhập sau");
    console.log("✓ Mã khôi phục chỉ dùng một lần, không lưu bản rõ trong CSDL");
  } finally {
    await cleanup();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
