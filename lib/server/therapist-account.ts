import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/password";

type TherapistAccountClient = Pick<Prisma.TransactionClient, "adminSession" | "therapist" | "user">;

export class TherapistAccountConflict extends Error {}

export function normalizeTherapistPhone(value: string) {
  const compact = value.trim().replace(/[\s.()-]/g, "");
  return compact.startsWith("+84") ? `0${compact.slice(3)}` : compact;
}

export function therapistAccountEmail(phone: string) {
  return `ktv.${phone}@accounts.tamancare.local`;
}

export function isTherapistLoginPhone(phone: string) {
  return /^0\d{9}$/.test(phone);
}

export async function ensureTherapistLoginAvailable(
  client: TherapistAccountClient,
  phone: string,
  therapistId?: string,
) {
  const email = therapistAccountEmail(phone);
  const [therapist, user] = await Promise.all([
    client.therapist.findFirst({ where: { phone }, select: { id: true } }),
    client.user.findFirst({
      where: {
        OR: [
          { username: { equals: phone, mode: "insensitive" } },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
      select: { id: true, therapistId: true },
    }),
  ]);
  if (therapist && therapist.id !== therapistId) {
    throw new TherapistAccountConflict("Số điện thoại đã thuộc một hồ sơ KTV khác.");
  }
  if (user && user.therapistId !== therapistId) {
    throw new TherapistAccountConflict("Số điện thoại đã được dùng làm tài khoản nội bộ khác.");
  }
}

export type TherapistAccountResult = {
  account: {
    id: string;
    username: string | null;
    isActive: boolean;
    passwordChangedAt: Date | null;
  };
  temporaryPassword: string | null;
};

export async function provisionTherapistAccount(
  client: TherapistAccountClient,
  input: {
    therapistId: string;
    fullName: string;
    phone: string;
    branchId: string;
    isActive: boolean;
    password?: string;
    resetPasswordToPhone?: boolean;
  },
): Promise<TherapistAccountResult> {
  const existing = await client.user.findFirst({
    where: { therapistId: input.therapistId },
    orderBy: { createdAt: "asc" },
  });
  const temporaryPhoneChanged = Boolean(
    existing?.passwordHash
    && existing.passwordChangedAt === null
    && existing.username !== input.phone,
  );
  const password = input.resetPasswordToPhone
    ? input.phone
    : input.password
      ? input.password
      : temporaryPhoneChanged
        ? input.phone
      : existing?.passwordHash
        ? null
        : input.phone;
  const passwordUsesPhone = password === input.phone;
  const credentialsChanged = Boolean(
    password
    || (existing && existing.username !== input.phone)
    || (existing && existing.branchId !== input.branchId)
    || (existing && existing.isActive !== input.isActive),
  );
  const credentialData = password
    ? {
      passwordHash: hashPassword(password),
      // Mật khẩu bằng số điện thoại là mật khẩu tạm thời và phải được đổi ở lần đăng nhập đầu.
      passwordChangedAt: passwordUsesPhone ? null : new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    }
    : {};
  const commonData = {
    therapistId: input.therapistId,
    name: input.fullName,
    username: input.phone,
    email: therapistAccountEmail(input.phone),
    role: "THERAPIST" as const,
    branchId: input.branchId,
    isActive: input.isActive,
    ...credentialData,
  };
  const account = existing
    ? await client.user.update({ where: { id: existing.id }, data: commonData })
    : await client.user.create({ data: commonData });

  if (existing && credentialsChanged) {
    await client.adminSession.deleteMany({ where: { userId: existing.id } });
  }
  return {
    account: {
      id: account.id,
      username: account.username,
      isActive: account.isActive,
      passwordChangedAt: account.passwordChangedAt,
    },
    temporaryPassword: password,
  };
}
