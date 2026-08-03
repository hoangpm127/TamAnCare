import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function secureTokenMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function nonNegativeInteger(value: string | null) {
  const parsed = Number(value ?? "0");
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!secureTokenMatches(url.searchParams.get("token"), process.env.ESMS_CALLBACK_TOKEN?.trim())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = url.searchParams.get("RequestId")?.trim();
  const smsId = url.searchParams.get("SMSID")?.trim();
  const sendStatus = nonNegativeInteger(url.searchParams.get("SendStatus"));
  const sendSuccess = nonNegativeInteger(url.searchParams.get("SendSuccess"));
  const sendFailed = nonNegativeInteger(url.searchParams.get("SendFailed"));
  if (!requestId || requestId.length > 50 || !smsId || smsId.length > 200) {
    return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
  }

  if (![4, 5].includes(sendStatus)) return NextResponse.json({ received: true, final: false });
  const delivered = sendStatus === 5 && sendSuccess > 0 && sendFailed === 0;
  const failedAt = delivered ? undefined : new Date();
  const deliveryStatus = delivered ? "SENT" as const : "FAILED" as const;
  const deliveryReference = smsId.slice(0, 200);

  const [phoneChallenges, passwordChallenges] = await db.$transaction([
    db.phoneOtpChallenge.updateMany({
      where: { id: requestId, consumedAt: null },
      data: { deliveryStatus, deliveryReference, consumedAt: failedAt },
    }),
    db.passwordResetChallenge.updateMany({
      where: { id: requestId, consumedAt: null },
      data: { deliveryStatus, deliveryReference, consumedAt: failedAt },
    }),
  ]);

  return NextResponse.json({
    received: true,
    final: true,
    delivered,
    matched: phoneChallenges.count + passwordChallenges.count,
  });
}
