import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyFirebasePhoneIdToken } from "@/lib/firebase-phone-server";
import { hashPassword } from "@/lib/password";
import {
  normalizeRecoveryPhone,
  PASSWORD_RESET_CODE_LENGTH,
  passwordResetCodeMatches,
  passwordResetDeliveryMode,
} from "@/lib/server/password-recovery";
import { notifyCustomer } from "@/lib/server/notification-service";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  phone: z.string().trim().regex(/^[0-9+ ]{8,15}$/),
  code: z.string().trim().regex(new RegExp(`^\\d{${PASSWORD_RESET_CODE_LENGTH}}$`)).optional(),
  firebaseIdToken: z.string().min(100).max(8_192).optional(),
  newPassword: z.string().min(15).max(72),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu đặt lại mật khẩu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã xác nhận hoặc mật khẩu mới chưa hợp lệ." }, { status: 400 });
  const phone = normalizeRecoveryPhone(parsed.data.phone);
  const phoneHash = privateIdentifierDigest(phone);
  const [ipLimit, phoneLimit] = await Promise.all([
    consumeRateLimit({ scope: "customer-reset-confirm-ip", identifier: requestIp(request), limit: 20, windowMs: 30 * 60_000 }),
    consumeRateLimit({ scope: "customer-reset-confirm-phone", identifier: phone, limit: 8, windowMs: 30 * 60_000, blockMs: 60 * 60_000 }),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Đã có quá nhiều lần thử. Vui lòng yêu cầu mã mới sau." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  if (passwordResetDeliveryMode() === "FIREBASE") {
    if (!parsed.data.firebaseIdToken) return NextResponse.json({ error: "Phiên xác minh Firebase chưa hợp lệ." }, { status: 400 });
    const firebaseIdentity = await verifyFirebasePhoneIdToken(parsed.data.firebaseIdToken);
    if (!firebaseIdentity || firebaseIdentity.phone !== phone) {
      return NextResponse.json({ error: "Mã không đúng, đã hết hạn hoặc số điện thoại không khớp." }, { status: 400 });
    }
    const account = await db.customerAccount.findUnique({ where: { phone }, select: { customerId: true } });
    if (!account) return NextResponse.json({ error: "Không thể xác minh yêu cầu khôi phục này." }, { status: 400 });
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.customerAccount.update({
        where: { customerId: account.customerId },
        data: { passwordHash: hashPassword(parsed.data.newPassword) },
      });
      await tx.customerSession.deleteMany({ where: { customerId: account.customerId } });
      await tx.passwordResetChallenge.updateMany({
        where: { phoneHash, consumedAt: null },
        data: { consumedAt: now },
      });
      await notifyCustomer(tx, account.customerId, {
        type: "SYSTEM",
        title: "Mật khẩu đã được đặt lại",
        body: "Tất cả phiên đăng nhập cũ đã bị thu hồi. Nếu không phải bạn thực hiện, hãy liên hệ Tâm An Center ngay.",
        actionUrl: "/tai-khoan",
      });
    });
    return NextResponse.json({ reset: true, sessionsRevoked: true });
  }

  if (!parsed.data.code) return NextResponse.json({ error: "Mã xác nhận chưa hợp lệ." }, { status: 400 });

  const now = new Date();
  const challenge = await db.passwordResetChallenge.findFirst({
    where: { phoneHash, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  const valid = Boolean(
    challenge
      && challenge.customerId
      && challenge.attempts < challenge.maxAttempts
      && passwordResetCodeMatches(challenge.codeHash, challenge.id, phoneHash, parsed.data.code),
  );
  if (!challenge || !valid) {
    if (challenge) {
      const nextAttempts = challenge.attempts + 1;
      await db.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
          consumedAt: nextAttempts >= challenge.maxAttempts ? now : undefined,
        },
      });
    }
    return NextResponse.json({ error: "Mã không đúng, đã hết hạn hoặc đã được sử dụng." }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.customerAccount.update({
      where: { customerId: challenge.customerId! },
      data: { passwordHash: hashPassword(parsed.data.newPassword) },
    });
    await tx.customerSession.deleteMany({ where: { customerId: challenge.customerId! } });
    await tx.passwordResetChallenge.updateMany({
      where: { phoneHash, consumedAt: null },
      data: { consumedAt: now },
    });
    await notifyCustomer(tx, challenge.customerId!, {
      type: "SYSTEM",
      title: "Mật khẩu đã được đặt lại",
      body: "Tất cả phiên đăng nhập cũ đã bị thu hồi. Nếu không phải bạn thực hiện, hãy liên hệ Tâm An Center ngay.",
      actionUrl: "/tai-khoan",
    });
  });
  return NextResponse.json({ reset: true, sessionsRevoked: true });
}
