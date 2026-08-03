import { randomUUID } from "node:crypto";
import type { PhoneOtpPurpose } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerOAuthPendingIdentityId } from "@/lib/server/customer-oauth";
import { getCustomerSession } from "@/lib/server/customer-session";
import { deliverOtpCode, otpDeliveryConfigured, phoneVerificationOnSignupRequired, phoneVerificationRequired } from "@/lib/server/otp-delivery";
import {
  createPhoneOtpCode,
  isVietnamMobilePhone,
  normalizeVietnamPhone,
  PHONE_OTP_TTL_MINUTES,
  phoneHash,
  phoneOtpCodeHash,
} from "@/lib/server/phone-otp";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

export const maxDuration = 15;

const allowedPurposes = ["CUSTOMER_SIGNUP", "CUSTOMER_SOCIAL_SIGNUP", "ACCOUNT_PHONE"] as const;
const schema = z.object({
  phone: z.string().trim().min(8).max(20),
  purpose: z.enum(allowedPurposes),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu gửi mã không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isVietnamMobilePhone(parsed.data.phone)) {
    return NextResponse.json({ error: "Vui lòng nhập đúng số điện thoại di động Việt Nam." }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const purpose = parsed.data.purpose as PhoneOtpPurpose;
  const verificationRequired = purpose === "ACCOUNT_PHONE"
    ? phoneVerificationRequired()
    : phoneVerificationOnSignupRequired();
  if (!verificationRequired) return NextResponse.json({ error: "Xác minh số điện thoại chưa được bật cho luồng này." }, { status: 409 });
  if (!otpDeliveryConfigured()) return NextResponse.json({ error: "Kênh gửi mã đang được cấu hình. Vui lòng thử lại sau." }, { status: 503 });
  const [ipLimit, phoneLimit, customerSession] = await Promise.all([
    consumeRateLimit({ scope: "phone-otp-request-ip", identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 }),
    consumeRateLimit({ scope: "phone-otp-request-phone", identifier: phone, limit: 3, windowMs: 60 * 60_000 }),
    purpose === "ACCOUNT_PHONE" ? getCustomerSession() : Promise.resolve(null),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json({ error: "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  if (purpose === "ACCOUNT_PHONE") {
    if (!customerSession) return NextResponse.json({ error: "Vui lòng đăng nhập lại để xác minh số điện thoại." }, { status: 401 });
    if (customerSession.phone !== phone) return NextResponse.json({ error: "Số điện thoại không khớp với tài khoản hiện tại." }, { status: 403 });
    if (customerSession.phoneVerifiedAt) return NextResponse.json({ verified: true, message: "Số điện thoại đã được xác minh." });
  } else {
    const existing = await db.customerAccount.findUnique({ where: { phone }, select: { customerId: true } });
    if (existing) return NextResponse.json({ error: "Số điện thoại đã có tài khoản. Hãy chuyển sang đăng nhập." }, { status: 409 });
    if (purpose === "CUSTOMER_SOCIAL_SIGNUP") {
      const identityId = await getCustomerOAuthPendingIdentityId();
      if (!identityId) return NextResponse.json({ error: "Phiên đăng nhập Google/Facebook đã hết hạn." }, { status: 401 });
    }
  }

  const challengeId = randomUUID();
  const code = createPhoneOtpCode();
  const digest = phoneHash(phone);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.phoneOtpChallenge.updateMany({
      where: { phoneHash: digest, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.phoneOtpChallenge.create({
      data: {
        id: challengeId,
        customerId: purpose === "ACCOUNT_PHONE" ? customerSession!.customerId : null,
        phoneHash: digest,
        purpose,
        codeHash: phoneOtpCodeHash(challengeId, digest, purpose, code),
        expiresAt: new Date(now.getTime() + PHONE_OTP_TTL_MINUTES * 60_000),
      },
    });
  });

  try {
    const delivery = await deliverOtpCode({
      requestId: challengeId,
      phone,
      code,
      expiresMinutes: PHONE_OTP_TTL_MINUTES,
      templateId: "TUETAM_PHONE_VERIFICATION",
    });
    await db.phoneOtpChallenge.updateMany({
      where: { id: challengeId, consumedAt: null, deliveryStatus: "PENDING" },
      data: { deliveryStatus: delivery.status, deliveryReference: delivery.reference },
    });

    return NextResponse.json({
      challengeId,
      expiresMinutes: PHONE_OTP_TTL_MINUTES,
      deliveryStatus: delivery.status,
      message: delivery.status === "PENDING"
        ? `eSMS đang chuyển mã tới số ${phone.slice(0, 3)}****${phone.slice(-3)}. Thường mất dưới một phút.`
        : `Mã xác minh đã được gửi tới số ${phone.slice(0, 3)}****${phone.slice(-3)}.`,
    }, { status: 202 });
  } catch {
    await db.phoneOtpChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { deliveryStatus: "FAILED", deliveryReference: "provider-failed", consumedAt: new Date() },
    });
    return NextResponse.json({ error: "Chưa thể gửi mã xác minh. Vui lòng thử lại sau." }, { status: 503 });
  }
}
