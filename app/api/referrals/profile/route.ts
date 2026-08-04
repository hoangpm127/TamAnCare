import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const profileSchema = z.object({
  affiliateArea: z.string().trim().min(2).max(120),
  affiliateBankName: z.string().trim().min(2).max(120),
  affiliateBankAccount: z.string().trim().regex(/^\d{6,30}$/),
  affiliateBankHolder: z.string().trim().min(2).max(120),
});

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu cập nhật không hợp lệ." }, { status: 403 });
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bạn cần đăng nhập để cập nhật hồ sơ Affiliate." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vui lòng điền đầy đủ khu vực và thông tin tài khoản nhận đối soát." }, { status: 400 });
  const rateLimit = await consumeRateLimit({
    scope: "customer-affiliate-profile",
    identifier: `${requestIp(request)}:${session.customerId}`,
    limit: 12,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Bạn đã cập nhật quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }
  const profile = await db.customerAccount.update({
    where: { customerId: session.customerId },
    data: parsed.data,
    select: { affiliateArea: true, affiliateBankName: true, affiliateBankAccount: true, affiliateBankHolder: true },
  });
  return NextResponse.json({ updated: true, profile });
}
