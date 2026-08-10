import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { customerPinError } from "@/lib/customer-pin";
import { hashPassword } from "@/lib/password";
import { createCustomerSession, customerAccountDto, getCustomerSession } from "@/lib/server/customer-session";
import { createCustomerMembership } from "@/lib/server/customer-registration";
import { getGuestSession } from "@/lib/server/guest-session";
import { isVietnamMobilePhone, normalizeVietnamPhone } from "@/lib/server/phone-otp";
import { bindInstalledReferralToCustomer } from "@/lib/server/referral-installation";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+ ]{8,15}$/),
  pin: z.string().regex(/^\d{4}$/),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  marketingOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu đăng ký không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Họ tên, số điện thoại hoặc Mã PIN chưa hợp lệ." }, { status: 400 });
  if (!isVietnamMobilePhone(parsed.data.phone)) return NextResponse.json({ error: "Vui lòng nhập đúng số điện thoại di động Việt Nam." }, { status: 400 });
  const phone = normalizeVietnamPhone(parsed.data.phone);
  const pinError = customerPinError(parsed.data.pin, phone);
  if (pinError) return NextResponse.json({ error: pinError }, { status: 400 });
  const [ipLimit, phoneLimit] = await Promise.all([
    consumeRateLimit({ scope: "customer-register-ip", identifier: requestIp(request), limit: 10, windowMs: 24 * 60 * 60_000 }),
    consumeRateLimit({ scope: "customer-register-phone", identifier: phone, limit: 3, windowMs: 24 * 60 * 60_000 }),
  ]);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Đã có quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau hoặc liên hệ Tâm An Center." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  const exists = await db.customerAccount.findUnique({ where: { phone } });
  if (exists) return NextResponse.json({ error: "Số điện thoại này đã có tài khoản. Hãy chuyển sang Đăng nhập." }, { status: 409 });

  const consentAt = new Date();
  const ipHash = privateIdentifierDigest(requestIp(request));
  const userAgent = request.headers.get("user-agent")?.trim();
  const userAgentHash = userAgent ? privateIdentifierDigest(userAgent) : undefined;
  const subjectHash = privateIdentifierDigest(phone);
  const account = await db.$transaction(async (tx) => {
      return createCustomerMembership(tx, {
        fullName: parsed.data.fullName,
        phone,
        passwordHash: null,
        pinHash: hashPassword(parsed.data.pin),
        phoneVerifiedAt: null,
        marketingOptIn: parsed.data.marketingOptIn,
        consentAt,
        subjectHash,
        ipHash,
        userAgentHash,
        firstSource: "CUSTOMER_SIGNUP",
      });
    });
  await createCustomerSession(account.customerId);
  const guestSession = await getGuestSession();
  if (guestSession) await bindInstalledReferralToCustomer(guestSession.id, account.customerId);
  const session = await getCustomerSession();
  return NextResponse.json({ account: session ? customerAccountDto(session) : customerAccountDto(account) }, { status: 201 });
}
