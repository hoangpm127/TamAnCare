import { NextResponse } from "next/server";
import { otpDeliveryConfigured, phoneVerificationOnSignupRequired, phoneVerificationRequired } from "@/lib/server/otp-delivery";
import { PHONE_OTP_CODE_LENGTH, PHONE_OTP_TTL_MINUTES } from "@/lib/server/phone-otp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const purpose = new URL(request.url).searchParams.get("purpose");
  const required = purpose === "CUSTOMER_SIGNUP" || purpose === "CUSTOMER_SOCIAL_SIGNUP"
    ? phoneVerificationOnSignupRequired()
    : phoneVerificationRequired();
  return NextResponse.json({
    required,
    configured: otpDeliveryConfigured(),
    codeLength: PHONE_OTP_CODE_LENGTH,
    expiresMinutes: PHONE_OTP_TTL_MINUTES,
  });
}
