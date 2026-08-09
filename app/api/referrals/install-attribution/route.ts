import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/server/customer-session";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { activateGuestReferral, captureGuestReferral } from "@/lib/server/referral-installation";
import { consumeRateLimit, isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CAPTURE"), code: z.string().trim().min(4).max(80) }),
  z.object({ action: z.literal("ACTIVATE"), code: z.string().trim().min(4).max(80).optional() }),
]);

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã giới thiệu chưa hợp lệ." }, { status: 400 });
  const [guest, customer] = await Promise.all([ensureGuestSession(), getCustomerSession()]);
  const rateLimit = await consumeRateLimit({
    scope: "referral-install-attribution",
    identifier: guest.id,
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Vui lòng thử lại sau ít phút." }, { status: 429 });

  const result = parsed.data.action === "CAPTURE"
    ? await captureGuestReferral(guest.id, parsed.data.code)
    : await activateGuestReferral({ guestSessionId: guest.id, code: parsed.data.code, customerId: customer?.customerId });
  if (!result) return NextResponse.json({ error: "Nguồn giới thiệu không còn hợp lệ." }, { status: 409 });
  return NextResponse.json({
    state: result.state,
    code: result.code,
    expiresAt: result.expiresAt.toISOString(),
  });
}
