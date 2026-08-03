import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getAdminSession } from "@/lib/server/admin-session";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateMfaRecoveryCodes,
  generateTotpSecret,
  mfaRecoveryCodeHash,
  totpProvisioningUri,
  verifyTotpCode,
} from "@/lib/server/totp";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, rateLimitIdentifier, requestIp } from "@/lib/server/request-security";

const setupSchema = z.object({ currentPassword: z.string().min(8).max(200) });
const confirmSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
const disableSchema = z.object({ currentPassword: z.string().min(8).max(200), code: z.string().trim().regex(/^\d{6}$/) });

function allowedRole(role: string) {
  return ["OWNER", "BRANCH_MANAGER", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"].includes(role);
}

async function managementSession() {
  const session = await getAdminSession();
  return session && !session.mustChangePassword && allowedRole(session.role) ? session : null;
}

export async function GET() {
  const session = await managementSession();
  if (!session) return NextResponse.json({ error: "Không có quyền quản lý MFA." }, { status: 403 });
  const [user, remainingRecoveryCodes] = await Promise.all([
    db.user.findUnique({ where: { id: session.id }, select: { mfaEnabledAt: true, mfaSetupExpiresAt: true } }),
    db.mfaRecoveryCode.count({ where: { userId: session.id, consumedAt: null } }),
  ]);
  return NextResponse.json({
    enabled: Boolean(user?.mfaEnabledAt),
    enabledAt: user?.mfaEnabledAt,
    setupPending: Boolean(user?.mfaSetupExpiresAt && user.mfaSetupExpiresAt > new Date()),
    remainingRecoveryCodes,
    required: session.mustEnrollMfa,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu thiết lập MFA không hợp lệ." }, { status: 403 });
  const session = await managementSession();
  if (!session) return NextResponse.json({ error: "Không có quyền thiết lập MFA." }, { status: 403 });
  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mật khẩu hiện tại chưa hợp lệ." }, { status: 400 });
  const limit = await consumeRateLimit({ scope: "admin-mfa-setup", identifier: rateLimitIdentifier(request, session.id), limit: 5, windowMs: 30 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Đã có quá nhiều lần thử. Vui lòng thử lại sau." }, { status: 429 });

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Mật khẩu hiện tại chưa đúng." }, { status: 401 });
  }
  if (user.mfaEnabledAt) return NextResponse.json({ error: "MFA đã được bật cho tài khoản này." }, { status: 409 });
  const secret = generateTotpSecret();
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        totpSecretEncrypted: encryptTotpSecret(secret),
        mfaSetupExpiresAt: expiresAt,
        lastTotpCounter: null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        branchId: user.branchId,
        action: "ADMIN_MFA_SETUP_STARTED",
        entityType: "User",
        entityId: user.id,
        after: { setupExpiresAt: expiresAt.toISOString() },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
  });
  return NextResponse.json({
    setup: true,
    manualKey: secret,
    provisioningUri: totpProvisioningUri(secret, user.username ?? user.email),
    expiresAt,
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu xác nhận MFA không hợp lệ." }, { status: 403 });
  const session = await managementSession();
  if (!session) return NextResponse.json({ error: "Không có quyền xác nhận MFA." }, { status: 403 });
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã Authenticator phải gồm 6 chữ số." }, { status: 400 });
  const limit = await consumeRateLimit({ scope: "admin-mfa-confirm", identifier: rateLimitIdentifier(request, session.id), limit: 8, windowMs: 15 * 60_000, blockMs: 30 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Đã có quá nhiều mã sai. Vui lòng thử lại sau." }, { status: 429 });

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user?.totpSecretEncrypted || !user.mfaSetupExpiresAt || user.mfaSetupExpiresAt <= new Date()) {
    return NextResponse.json({ error: "Phiên thiết lập đã hết hạn. Hãy bắt đầu lại." }, { status: 409 });
  }
  const counter = verifyTotpCode(decryptTotpSecret(user.totpSecretEncrypted), parsed.data.code);
  if (counter === null) return NextResponse.json({ error: "Mã Authenticator chưa đúng." }, { status: 400 });
  const recoveryCodes = generateMfaRecoveryCodes();
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { mfaEnabledAt: now, mfaSetupExpiresAt: null, lastTotpCounter: counter },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: mfaRecoveryCodeHash(code) })),
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        branchId: user.branchId,
        action: "ADMIN_MFA_ENABLED",
        entityType: "User",
        entityId: user.id,
        after: { recoveryCodeCount: recoveryCodes.length },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
  });
  return NextResponse.json({ enabled: true, enabledAt: now, recoveryCodes });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu tắt MFA không hợp lệ." }, { status: 403 });
  const session = await managementSession();
  if (!session) return NextResponse.json({ error: "Không có quyền tắt MFA." }, { status: 403 });
  const parsed = disableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiếu mật khẩu hoặc mã Authenticator." }, { status: 400 });
  const limit = await consumeRateLimit({ scope: "admin-mfa-disable", identifier: rateLimitIdentifier(request, session.id), limit: 5, windowMs: 30 * 60_000, blockMs: 60 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Đã có quá nhiều lần thử tắt MFA. Vui lòng thử lại sau." }, { status: 429 });
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash || !user.totpSecretEncrypted || !user.mfaEnabledAt) return NextResponse.json({ error: "MFA chưa được bật." }, { status: 409 });
  const counter = verifyTotpCode(decryptTotpSecret(user.totpSecretEncrypted), parsed.data.code);
  if (!verifyPassword(parsed.data.currentPassword, user.passwordHash) || counter === null || (user.lastTotpCounter !== null && counter <= user.lastTotpCounter)) {
    return NextResponse.json({ error: "Mật khẩu hoặc mã Authenticator chưa đúng." }, { status: 401 });
  }
  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: { totpSecretEncrypted: null, mfaSetupExpiresAt: null, mfaEnabledAt: null, lastTotpCounter: null },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        branchId: user.branchId,
        action: "ADMIN_MFA_DISABLED",
        entityType: "User",
        entityId: user.id,
        after: { allSessionsRevoked: true },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    await tx.adminSession.deleteMany({ where: { userId: user.id } });
  });
  return NextResponse.json({ disabled: true, sessionsRevoked: true });
}
