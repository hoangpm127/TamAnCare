import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createCustomerSession, customerAccountDto } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { isVietnamMobilePhone, normalizeVietnamPhone } from "@/lib/server/phone-otp";
import { bindInstalledReferralToCustomer } from "@/lib/server/referral-installation";
import { clearRateLimit, consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  phone: z.string().trim().min(8),
  pin: z.string().regex(/^\d{4}$/),
});
const DUMMY_PASSWORD_HASH = "scrypt:0123456789abcdef0123456789abcdef:115babb3388379f33e3094f0913751b9fff81cce9585c9edc92b9afb5330c9ecb004a51ef9dcaab762d5bb920e30c0a38422bff9b0f449054775ab71f6d7b6c6";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu đăng nhập không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin đăng nhập chưa hợp lệ." }, { status: 400 });
  if (!isVietnamMobilePhone(parsed.data.phone)) return NextResponse.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });
  const phone = normalizeVietnamPhone(parsed.data.phone);
  const identity = phone;
  const [ipLimit, accountLimit] = await Promise.all([
    consumeRateLimit({ scope: "customer-login-ip", identifier: requestIp(request), limit: 20, windowMs: 15 * 60_000, blockMs: 30 * 60_000 }),
    consumeRateLimit({ scope: "customer-login-account", identifier: identity, limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 }),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Đã có quá nhiều lần đăng nhập. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  const account = await db.customerAccount.findUnique({
    where: { phone },
    include: { customer: { include: { oauthIdentities: { where: { customerId: { not: null } } } } } },
  });
  const credentialMatches = verifyPassword(parsed.data.pin, account?.pinHash ?? DUMMY_PASSWORD_HASH);
  if (!account || !credentialMatches) {
    return NextResponse.json({ error: "Số điện thoại hoặc Mã PIN Tâm An chưa đúng." }, { status: 401 });
  }
  await createCustomerSession(account.customerId);
  const guestSession = await getGuestSession();
  if (guestSession) await bindInstalledReferralToCustomer(guestSession.id, account.customerId);
  await Promise.all([
    clearRateLimit("customer-login-ip", requestIp(request)),
    clearRateLimit("customer-login-account", identity),
  ]);
  return NextResponse.json({ account: customerAccountDto(account) });
}
