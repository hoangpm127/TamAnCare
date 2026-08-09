import { NextResponse } from "next/server";
import { z } from "zod";
import { customerPinError } from "@/lib/customer-pin";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getCustomerSession } from "@/lib/server/customer-session";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function PUT(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const account = await getCustomerSession();
  if (!account) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  if (account.pinHash) return NextResponse.json({ error: "Để đổi Mã PIN, vui lòng đến lễ tân để được đối chiếu trực tiếp." }, { status: 409 });
  const rateLimit = await consumeRateLimit({ scope: "customer-pin-update", identifier: `${requestIp(request)}:${account.customerId}`, limit: 5, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã có quá nhiều lần đổi mã. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã PIN phải gồm đúng 4 số." }, { status: 400 });
  const pinError = customerPinError(parsed.data.pin, account.phone);
  if (pinError) return NextResponse.json({ error: pinError }, { status: 400 });
  await db.customerAccount.update({ where: { customerId: account.customerId }, data: { pinHash: hashPassword(parsed.data.pin) } });
  return NextResponse.json({ ok: true });
}
