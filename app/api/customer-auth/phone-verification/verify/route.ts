import type { PhoneOtpPurpose } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerOAuthPendingIdentityId } from "@/lib/server/customer-oauth";
import { getCustomerSession } from "@/lib/server/customer-session";
import { phoneVerificationOnSignupRequired, phoneVerificationRequired } from "@/lib/server/otp-delivery";
import {
  createPhoneVerificationToken,
  isVietnamMobilePhone,
  normalizeVietnamPhone,
  PHONE_OTP_CODE_LENGTH,
  phoneHash,
  phoneOtpCodeMatches,
} from "@/lib/server/phone-otp";
import { clearRateLimit, consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const allowedPurposes = ["CUSTOMER_SIGNUP", "CUSTOMER_SOCIAL_SIGNUP", "ACCOUNT_PHONE"] as const;
const schema = z.object({
  phone: z.string().trim().min(8).max(20),
  purpose: z.enum(allowedPurposes),
  challengeId: z.string().uuid(),
  code: z.string().regex(new RegExp(`^\\d{${PHONE_OTP_CODE_LENGTH}}$`)),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu xác minh không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isVietnamMobilePhone(parsed.data.phone)) return NextResponse.json({ error: "Mã hoặc số điện thoại chưa hợp lệ." }, { status: 400 });

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const purpose = parsed.data.purpose as PhoneOtpPurpose;
  const verificationRequired = purpose === "ACCOUNT_PHONE"
    ? phoneVerificationRequired()
    : phoneVerificationOnSignupRequired();
  if (!verificationRequired) return NextResponse.json({ error: "Xác minh số điện thoại chưa được bật cho luồng này." }, { status: 409 });
  const [rateLimit, customerSession] = await Promise.all([
    consumeRateLimit({ scope: "phone-otp-verify", identifier: `${requestIp(request)}:${phone}`, limit: 8, windowMs: 30 * 60_000, blockMs: 60 * 60_000 }),
    purpose === "ACCOUNT_PHONE" ? getCustomerSession() : Promise.resolve(null),
  ]);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã có quá nhiều lần thử. Vui lòng yêu cầu mã mới sau." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  if (purpose === "ACCOUNT_PHONE") {
    if (!customerSession) return NextResponse.json({ error: "Vui lòng đăng nhập lại để xác minh số điện thoại." }, { status: 401 });
    if (customerSession.phone !== phone) return NextResponse.json({ error: "Số điện thoại không khớp với tài khoản hiện tại." }, { status: 403 });
  } else if (purpose === "CUSTOMER_SOCIAL_SIGNUP") {
    const identityId = await getCustomerOAuthPendingIdentityId();
    if (!identityId) return NextResponse.json({ error: "Phiên đăng nhập Google/Facebook đã hết hạn." }, { status: 401 });
  }

  const now = new Date();
  const digest = phoneHash(phone);
  const challenge = await db.phoneOtpChallenge.findFirst({
    where: {
      id: parsed.data.challengeId,
      phoneHash: digest,
      purpose,
      consumedAt: null,
      expiresAt: { gt: now },
      deliveryStatus: { in: ["SENT", "TEST_MODE"] },
    },
  });
  const valid = Boolean(
    challenge
      && challenge.attempts < challenge.maxAttempts
      && phoneOtpCodeMatches(challenge.codeHash, challenge.id, digest, purpose, parsed.data.code),
  );
  if (!challenge || !valid) {
    if (challenge) {
      const nextAttempts = challenge.attempts + 1;
      await db.phoneOtpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 }, consumedAt: nextAttempts >= challenge.maxAttempts ? now : undefined },
      });
    }
    return NextResponse.json({ error: "Mã không đúng, đã hết hạn hoặc đã được sử dụng." }, { status: 400 });
  }

  const verification = createPhoneVerificationToken();
  const claimed = await db.$transaction(async (tx) => {
    const updated = await tx.phoneOtpChallenge.updateMany({
      where: { id: challenge.id, verifiedAt: null, consumedAt: null },
      data: {
        verifiedAt: now,
        verificationTokenHash: verification.tokenHash,
        expiresAt: new Date(now.getTime() + 10 * 60_000),
        consumedAt: purpose === "ACCOUNT_PHONE" ? now : null,
      },
    });
    if (updated.count !== 1) return false;
    if (purpose === "ACCOUNT_PHONE") {
      await tx.customerAccount.update({ where: { customerId: customerSession!.customerId }, data: { phoneVerifiedAt: now } });
    }
    return true;
  });
  if (!claimed) return NextResponse.json({ error: "Mã đã được xác minh ở một yêu cầu khác. Vui lòng tiếp tục tại thiết bị đó hoặc gửi mã mới." }, { status: 409 });
  await clearRateLimit("phone-otp-verify", `${requestIp(request)}:${phone}`);

  return NextResponse.json(purpose === "ACCOUNT_PHONE"
    ? { verified: true, message: "Số điện thoại đã được xác minh." }
    : { verified: true, verificationToken: verification.token, expiresMinutes: 10 });
}
