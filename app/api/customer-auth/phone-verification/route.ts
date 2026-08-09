import { NextResponse } from "next/server";
import { firebasePhonePublicConfig } from "@/lib/firebase-phone-server";
import { inspectOtpDeliveryReadiness, phoneVerificationOnSignupRequired, phoneVerificationRequired } from "@/lib/server/otp-delivery";
import { PHONE_OTP_CODE_LENGTH, PHONE_OTP_TTL_MINUTES } from "@/lib/server/phone-otp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const purpose = new URL(request.url).searchParams.get("purpose");
  const required = purpose === "CUSTOMER_SIGNUP" || purpose === "CUSTOMER_SOCIAL_SIGNUP"
    ? phoneVerificationOnSignupRequired()
    : phoneVerificationRequired();
  const readiness = required ? await inspectOtpDeliveryReadiness() : null;
  return NextResponse.json({
    required,
    configured: !required || readiness?.state === "READY",
    provider: readiness?.provider ?? null,
    firebase: readiness?.provider === "FIREBASE" ? firebasePhonePublicConfig() : null,
    deliveryStatus: readiness?.state ?? "OPTIONAL",
    codeLength: PHONE_OTP_CODE_LENGTH,
    expiresMinutes: PHONE_OTP_TTL_MINUTES,
  });
}
