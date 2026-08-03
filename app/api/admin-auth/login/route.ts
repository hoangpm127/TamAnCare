import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSession } from "@/lib/server/admin-session";
import {
  clearRateLimit,
  consumeRateLimit,
  isSameOriginMutation,
  rateLimitIdentifier,
  requestIp,
} from "@/lib/server/request-security";

const schema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(200),
  mfaCode: z.string().trim().min(6).max(40).optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập không hợp lệ." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin đăng nhập chưa hợp lệ." }, { status: 400 });

  const identity = rateLimitIdentifier(request, parsed.data.username);
  const [ipLimit, accountLimit] = await Promise.all([
    consumeRateLimit({ scope: "admin-login-ip", identifier: requestIp(request), limit: 10, windowMs: 15 * 60_000, blockMs: 30 * 60_000 }),
    consumeRateLimit({ scope: "admin-login-account", identifier: identity, limit: 5, windowMs: 15 * 60_000, blockMs: 30 * 60_000 }),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Đã có quá nhiều lần đăng nhập. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const result = await createAdminSession(parsed.data.username, parsed.data.password, parsed.data.mfaCode);
  if (!result) return NextResponse.json({ error: parsed.data.mfaCode ? "Mã xác thực không đúng hoặc đã được sử dụng." : "Tài khoản hoặc mật khẩu chưa đúng." }, { status: 401 });
  if (result.status === "MFA_REQUIRED") return NextResponse.json({ mfaRequired: true });
  await Promise.all([
    clearRateLimit("admin-login-ip", requestIp(request)),
    clearRateLimit("admin-login-account", identity),
  ]);
  return NextResponse.json({ account: result.account });
}
