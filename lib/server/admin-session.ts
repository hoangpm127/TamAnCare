import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { decryptTotpSecret, isManagementMfaRequired, mfaRecoveryCodeHash, verifyTotpCode } from "@/lib/server/totp";
import { looksLikeCorruptedVietnamese, repairLegacyVisibleText } from "@/lib/server/text-safety";
import {
  permissionsForAdminRole,
  type AdminAccount,
  type AdminRole,
} from "@/lib/admin-auth";

const COOKIE_NAME = "tt_admin_session_v2";
const LEGACY_COOKIE_NAME = "tt_admin_session";
const SESSION_DAYS = 7;
const MAX_FAILED_LOGINS = 5;
const ACCOUNT_LOCK_MINUTES = 15;
const DUMMY_PASSWORD_HASH = "scrypt:0123456789abcdef0123456789abcdef:115babb3388379f33e3094f0913751b9fff81cce9585c9edc92b9afb5330c9ecb004a51ef9dcaab762d5bb920e30c0a38422bff9b0f449054775ab71f6d7b6c6";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expiresAt: Date) {
  const secure = process.env.SESSION_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.SESSION_COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
    priority: "high" as const,
  };
}

function mapRole(role: string): AdminRole {
  if (role === "OWNER") return "OWNER";
  if (role === "MANAGER") return "BRANCH_MANAGER";
  if (role === "INVESTOR") return "INVESTOR";
  if (role === "THERAPIST") return "THERAPIST";
  if (role === "XGROUP_SUPER_ADMIN") return "XGROUP_SUPER_ADMIN";
  if (role === "DISTRICT_SALES_MANAGER") return "DISTRICT_SALES_MANAGER";
  return "RECEPTIONIST";
}

function userToAccount(user: {
  id: string;
  username: string | null;
  name: string;
  role: string;
  branchId: string | null;
  therapistId: string | null;
  passwordChangedAt: Date | null;
  mfaEnabledAt: Date | null;
  branch?: { name: string } | null;
}): AdminAccount {
  const role = mapRole(user.role);
  const knownNames: Record<string, string> = {
    admin: "Admin Tâm An",
    quanlycs1: "Quản lý Cơ sở 1",
    quanlycs2: "Quản lý Cơ sở 2",
    letancs1: "Lễ tân Cơ sở 1",
    letancs2: "Lễ tân Cơ sở 2",
    ktvcs1: "KTV Cơ sở 1",
    ktvcs2: "KTV Cơ sở 2",
    nhadaututaman: "Nhà đầu tư Tâm An",
    "xgroup.superadmin": "Xgroup Super Admin",
    "truongphong.caugiay": "Trưởng phòng KD Quận Cầu Giấy",
  };
  const fallbackName = knownNames[user.username?.toLowerCase() ?? ""]
    ?? (role === "XGROUP_SUPER_ADMIN" ? "Xgroup Super Admin" : role === "DISTRICT_SALES_MANAGER" ? "Trưởng phòng KD cấp Quận" : role === "OWNER" ? "Admin Tâm An" : role === "BRANCH_MANAGER" ? "Quản lý cơ sở" : role === "RECEPTIONIST" ? "Lễ tân cơ sở" : role === "THERAPIST" ? "Kỹ thuật viên" : "Nhà đầu tư Tâm An");
  const repairedName = repairLegacyVisibleText(user.name);
  return {
    id: user.id,
    displayName: looksLikeCorruptedVietnamese(repairedName) ? fallbackName : repairedName,
    title: role === "XGROUP_SUPER_ADMIN"
      ? "Siêu quản trị Xgroup · Tâm An Business"
      : role === "DISTRICT_SALES_MANAGER"
        ? "Trưởng phòng Kinh doanh cấp Quận"
        : role === "OWNER"
      ? "Quản trị viên tổng"
      : role === "BRANCH_MANAGER"
        ? "Quản lý vận hành cơ sở"
        : role === "INVESTOR"
          ? "Đối tác đầu tư · chỉ xem báo cáo"
          : role === "THERAPIST"
            ? "Kỹ thuật viên · lịch ca cá nhân"
            : "Lễ tân cơ sở",
    role,
    branchId: user.branchId,
    therapistId: user.therapistId,
    branchLabel: role === "XGROUP_SUPER_ADMIN"
      ? "Toàn bộ Tâm An Business"
      : role === "DISTRICT_SALES_MANAGER"
        ? "Quận được phân quyền"
        : role === "OWNER"
      ? "Toàn hệ thống"
      : role === "INVESTOR"
        ? "Danh mục đầu tư"
        : user.branch?.name.replace(/^Tâm An Center · /, "") ?? "Cơ sở",
    permissions: permissionsForAdminRole(role),
    mustChangePassword: !user.passwordChangedAt,
    mfaEnabled: Boolean(user.mfaEnabledAt),
    mustEnrollMfa: isManagementMfaRequired(user.role) && !user.mfaEnabledAt,
  };
}

export type AdminLoginResult =
  | { status: "AUTHENTICATED"; account: AdminAccount }
  | { status: "MFA_REQUIRED" }
  | null;

export async function createAdminSession(username: string, password: string, mfaCode?: string): Promise<AdminLoginResult> {
  const normalizedUsername = username.trim();
  const now = new Date();
  const user = await db.user.findFirst({
    where: {
      username: { equals: normalizedUsername, mode: "insensitive" },
      role: { in: ["OWNER", "MANAGER", "RECEPTIONIST", "THERAPIST", "INVESTOR", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"] },
    },
    include: { branch: true },
  });

  if (!user?.passwordHash || !user.isActive) {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }
  if (user.lockedUntil && user.lockedUntil > now) return null;

  if (!verifyPassword(password, user.passwordHash)) {
    const failedLoginCount = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= MAX_FAILED_LOGINS
          ? new Date(now.getTime() + ACCOUNT_LOCK_MINUTES * 60_000)
          : null,
      },
    });
    return null;
  }

  if (user.mfaEnabledAt) {
    if (!user.totpSecretEncrypted) return null;
    if (!mfaCode?.trim()) return { status: "MFA_REQUIRED" };
    const normalizedMfaCode = mfaCode.trim();
    let secondFactorAccepted = false;
    if (/^\d{6}$/.test(normalizedMfaCode)) {
      const counter = verifyTotpCode(decryptTotpSecret(user.totpSecretEncrypted), normalizedMfaCode);
      if (counter !== null) {
        const updated = await db.user.updateMany({
          where: {
            id: user.id,
            OR: [{ lastTotpCounter: null }, { lastTotpCounter: { lt: counter } }],
          },
          data: { lastTotpCounter: counter },
        });
        secondFactorAccepted = updated.count === 1;
      }
    } else {
      const recoveryHash = mfaRecoveryCodeHash(normalizedMfaCode);
      const recoveryCode = await db.mfaRecoveryCode.findUnique({ where: { codeHash: recoveryHash } });
      if (recoveryCode?.userId === user.id && !recoveryCode.consumedAt) {
        const consumed = await db.mfaRecoveryCode.updateMany({
          where: { id: recoveryCode.id, userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        secondFactorAccepted = consumed.count === 1;
      }
    }
    if (!secondFactorAccepted) return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { userId: user.id, createdAt: { lt: new Date(now.getTime() - SESSION_DAYS * 24 * 60 * 60 * 1000) } }] } }),
    db.adminSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt } }),
    db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, cookieOptions(expiresAt));
  cookieStore.delete(LEGACY_COOKIE_NAME);
  return { status: "AUTHENTICATED", account: userToAccount(user) };
}

export async function getAdminSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { branch: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  return userToAccount(session.user);
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

export async function changeAdminPassword(userId: string, currentPassword: string, nextPassword: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const currentTokenHash = tokenHash(token);
  const session = await db.adminSession.findFirst({
    where: { tokenHash: currentTokenHash, userId, expiresAt: { gt: new Date() } },
    include: { user: { include: { branch: true } } },
  });
  if (!session?.user.passwordHash || !verifyPassword(currentPassword, session.user.passwordHash)) return null;

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(nextPassword),
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
      include: { branch: true },
    });
    await tx.adminSession.deleteMany({
      where: { userId, tokenHash: { not: currentTokenHash } },
    });
    return user;
  });
  return userToAccount(updated);
}

export async function requireAdminSession(roles: AdminAccount["role"][] = ["OWNER", "BRANCH_MANAGER"]) {
  const session = await getAdminSession();
  return session && !session.mustChangePassword && roles.includes(session.role) ? session : null;
}
