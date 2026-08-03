import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clearCustomerOAuthPending,
  getCustomerOAuthPendingIdentityId,
} from "@/lib/server/customer-oauth";
import { createCustomerMembership } from "@/lib/server/customer-registration";
import { createCustomerSession, customerAccountDto, getCustomerSession } from "@/lib/server/customer-session";
import { phoneVerificationOnSignupRequired } from "@/lib/server/otp-delivery";
import { consumePhoneVerification, isVietnamMobilePhone, normalizeVietnamPhone } from "@/lib/server/phone-otp";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+ ]{8,15}$/),
  phoneVerificationToken: z.string().min(32).max(200).nullable().optional(),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  marketingOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu hoàn tất tài khoản không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Họ tên, số điện thoại hoặc xác nhận điều khoản chưa hợp lệ." }, { status: 400 });
  const identityId = await getCustomerOAuthPendingIdentityId();
  if (!identityId) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 });

  if (!isVietnamMobilePhone(parsed.data.phone)) return NextResponse.json({ error: "Vui lòng nhập đúng số điện thoại di động Việt Nam." }, { status: 400 });
  const phone = normalizeVietnamPhone(parsed.data.phone);
  const requiresPhoneVerification = phoneVerificationOnSignupRequired();
  if (requiresPhoneVerification && !parsed.data.phoneVerificationToken) {
    return NextResponse.json({ error: "Vui lòng xác minh số điện thoại trước khi hoàn tất tài khoản." }, { status: 400 });
  }
  const [ipLimit, phoneLimit, identity] = await Promise.all([
    consumeRateLimit({ scope: "customer-oauth-complete-ip", identifier: requestIp(request), limit: 10, windowMs: 24 * 60 * 60_000 }),
    consumeRateLimit({ scope: "customer-oauth-complete-phone", identifier: phone, limit: 3, windowMs: 24 * 60 * 60_000 }),
    db.customerOAuthIdentity.findFirst({
      where: { id: identityId, customerId: null, pendingExpiresAt: { gt: new Date() } },
    }),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json({ error: "Đã có quá nhiều yêu cầu. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  if (!identity) {
    await clearCustomerOAuthPending();
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 });
  }

  const exists = await db.customerAccount.findUnique({ where: { phone }, select: { customerId: true } });
  if (exists) {
    return NextResponse.json({
      error: "Số điện thoại này đã có tài khoản. Hãy đăng nhập bằng số điện thoại, sau đó liên kết Google hoặc Facebook trong tài khoản.",
      code: "PHONE_ALREADY_REGISTERED",
    }, { status: 409 });
  }

  const consentAt = new Date();
  const ipHash = privateIdentifierDigest(requestIp(request));
  const userAgent = request.headers.get("user-agent")?.trim();
  const userAgentHash = userAgent ? privateIdentifierDigest(userAgent) : undefined;
  const subjectHash = privateIdentifierDigest(phone);

  try {
    const account = await db.$transaction(async (tx) => {
      const created = await createCustomerMembership(tx, {
        fullName: parsed.data.fullName,
        phone,
        passwordHash: null,
        phoneVerifiedAt: requiresPhoneVerification ? consentAt : null,
        email: identity.email,
        marketingOptIn: parsed.data.marketingOptIn,
        consentAt,
        subjectHash,
        ipHash,
        userAgentHash,
        firstSource: "CUSTOMER_SOCIAL_SIGNUP",
      });
      if (requiresPhoneVerification) {
        const verified = await consumePhoneVerification(tx, {
          phone,
          purpose: "CUSTOMER_SOCIAL_SIGNUP",
          token: parsed.data.phoneVerificationToken!,
        });
        if (!verified) throw new Error("PHONE_VERIFICATION_INVALID");
      }
      const linked = await tx.customerOAuthIdentity.updateMany({
        where: { id: identity.id, customerId: null, pendingExpiresAt: { gt: consentAt } },
        data: { customerId: created.customerId, pendingExpiresAt: null, lastLoginAt: consentAt },
      });
      if (linked.count !== 1) throw new Error("OAUTH_IDENTITY_LINK_RACE");
      return created;
    });
    await createCustomerSession(account.customerId);
    await clearCustomerOAuthPending();
    const session = await getCustomerSession();
    return NextResponse.json({ account: session ? customerAccountDto(session) : customerAccountDto(account) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PHONE_VERIFICATION_INVALID") {
      return NextResponse.json({ error: "Phiên xác minh đã hết hạn hoặc đã được sử dụng. Vui lòng gửi mã mới." }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Số điện thoại hoặc tài khoản mạng xã hội đã được sử dụng." }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể hoàn tất tài khoản. Vui lòng thử lại." }, { status: 500 });
  }
}
