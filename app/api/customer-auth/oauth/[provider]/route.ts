import { NextResponse } from "next/server";
import {
  createCustomerOAuthAuthorizationUrl,
  customerOAuthIsAvailable,
  parseCustomerOAuthProvider,
} from "@/lib/server/customer-oauth";
import { publicAppUrl } from "@/lib/public-app-url";
import { consumeRateLimit, requestIp } from "@/lib/server/request-security";
import { safeCustomerReturnPath } from "@/lib/safe-return-path";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const provider = parseCustomerOAuthProvider((await context.params).provider);
  if (!provider) return NextResponse.json({ error: "Nhà cung cấp đăng nhập không hợp lệ." }, { status: 404 });
  if (!customerOAuthIsAvailable(provider)) {
    return NextResponse.redirect(publicAppUrl(`/tai-khoan?oauthError=provider-unavailable&provider=${provider}`, request));
  }

  const limit = await consumeRateLimit({
    scope: "customer-oauth-start-ip",
    identifier: requestIp(request),
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.redirect(publicAppUrl("/tai-khoan?oauthError=rate-limited", request));
  }

  try {
    const returnTo = safeCustomerReturnPath(new URL(request.url).searchParams.get("returnTo"));
    const authorizationUrl = await createCustomerOAuthAuthorizationUrl(provider, request, returnTo);
    return NextResponse.redirect(authorizationUrl);
  } catch {
    return NextResponse.redirect(publicAppUrl(`/tai-khoan?oauthError=provider-unavailable&provider=${provider}`, request));
  }
}
