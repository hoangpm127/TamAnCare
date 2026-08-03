import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  deliverPasswordResetCode,
  normalizeRecoveryPhone,
  PASSWORD_RESET_TTL_MINUTES,
  passwordResetCode,
  passwordResetCodeHash,
  passwordResetDeliveryMode,
} from "@/lib/server/password-recovery";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

export const maxDuration = 15;

const schema = z.object({ phone: z.string().trim().regex(/^[0-9+ ]{8,15}$/) });

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu khôi phục không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });
  const phone = normalizeRecoveryPhone(parsed.data.phone);
  const [ipLimit, phoneLimit] = await Promise.all([
    consumeRateLimit({ scope: "customer-reset-request-ip", identifier: requestIp(request), limit: 8, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: "customer-reset-request-phone", identifier: phone, limit: 3, windowMs: 60 * 60_000 }),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Đã có quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const [account, challengeId, code] = await Promise.all([
    db.customerAccount.findUnique({ where: { phone }, select: { customerId: true } }),
    Promise.resolve(randomUUID()),
    Promise.resolve(passwordResetCode()),
  ]);
  const phoneHash = privateIdentifierDigest(phone);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.passwordResetChallenge.updateMany({
      where: { phoneHash, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.passwordResetChallenge.create({
      data: {
        id: challengeId,
        customerId: account?.customerId,
        phoneHash,
        codeHash: passwordResetCodeHash(challengeId, phoneHash, code),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
        deliveryStatus: account ? "PENDING" : "IGNORED",
      },
    });
  });

  if (account) after(() => deliverPasswordResetCode(challengeId, phone, code));
  return NextResponse.json(
    {
      accepted: true,
      deliveryConfigured: passwordResetDeliveryMode() !== "DISABLED",
      message: "Nếu số điện thoại có tài khoản, mã khôi phục sẽ được gửi qua kênh đã cấu hình.",
    },
    { status: 202 },
  );
}
