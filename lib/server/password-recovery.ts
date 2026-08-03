import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { deliverOtpCode, otpDeliveryMode } from "@/lib/server/otp-delivery";
import { normalizeVietnamPhone } from "@/lib/server/phone-otp";

export const PASSWORD_RESET_TTL_MINUTES = 10;
export const PASSWORD_RESET_CODE_LENGTH = 8;

function recoverySecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET chưa được cấu hình cho khôi phục tài khoản.");
  return secret ?? "tam-an-local-password-recovery-secret";
}

export function normalizeRecoveryPhone(value: string) {
  return normalizeVietnamPhone(value);
}

export function passwordResetCode() {
  const testCode = process.env.NODE_ENV !== "production" ? process.env.AUTH_OTP_TEST_CODE?.trim() : undefined;
  if (testCode && new RegExp(`^\\d{${PASSWORD_RESET_CODE_LENGTH}}$`).test(testCode)) return testCode;
  return String(randomInt(0, 10 ** PASSWORD_RESET_CODE_LENGTH)).padStart(PASSWORD_RESET_CODE_LENGTH, "0");
}

export function passwordResetCodeHash(challengeId: string, phoneHash: string, code: string) {
  return createHmac("sha256", recoverySecret())
    .update(`${challengeId}:${phoneHash}:${code}`)
    .digest("hex");
}

export function passwordResetCodeMatches(expectedHash: string, challengeId: string, phoneHash: string, code: string) {
  const actual = Buffer.from(passwordResetCodeHash(challengeId, phoneHash, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function passwordResetDeliveryMode() {
  if (process.env.NODE_ENV !== "production" && /^\d{8}$/.test(process.env.AUTH_OTP_TEST_CODE?.trim() ?? "")) return "TEST_MODE" as const;
  const mode = otpDeliveryMode();
  return mode === "TEST_MODE" ? "DISABLED" as const : mode;
}

export async function deliverPasswordResetCode(challengeId: string, phone: string, code: string) {
  const mode = passwordResetDeliveryMode();
  if (mode === "TEST_MODE") {
    await db.passwordResetChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { deliveryStatus: "TEST_MODE", deliveryReference: "local-test-channel" },
    });
    return;
  }
  if (mode === "DISABLED") {
    await db.passwordResetChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { deliveryStatus: "FAILED", deliveryReference: "delivery-not-configured" },
    });
    return;
  }

  try {
    const delivery = await deliverOtpCode({
      requestId: challengeId,
      phone,
      code,
      expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      templateId: "TAMAN_PASSWORD_RESET",
    });
    await db.passwordResetChallenge.updateMany({
      where: { id: challengeId, consumedAt: null, deliveryStatus: "PENDING" },
      data: {
        deliveryStatus: delivery.status,
        deliveryReference: delivery.reference,
      },
    });
  } catch {
    await db.passwordResetChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { deliveryStatus: "FAILED", deliveryReference: "provider-failed" },
    });
  }
}
