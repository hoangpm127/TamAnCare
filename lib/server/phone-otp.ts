import "server-only";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { PhoneOtpPurpose, Prisma } from "@/app/generated/prisma/client";
import { privateIdentifierDigest } from "@/lib/server/request-security";

export const PHONE_OTP_CODE_LENGTH = 6;
export const PHONE_OTP_TTL_MINUTES = 5;

function otpSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET chưa được cấu hình cho OTP.");
  return secret ?? "tam-an-local-phone-otp-secret";
}

export function normalizeVietnamPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84")) return `0${digits.slice(2)}`;
  return digits;
}

export function isVietnamMobilePhone(value: string) {
  return /^0(?:3|5|7|8|9)\d{8}$/.test(normalizeVietnamPhone(value));
}

export function phoneHash(phone: string) {
  return privateIdentifierDigest(normalizeVietnamPhone(phone));
}

export function createPhoneOtpCode() {
  const testCode = process.env.NODE_ENV !== "production" ? process.env.PHONE_OTP_TEST_CODE?.trim() : undefined;
  if (testCode && new RegExp(`^\\d{${PHONE_OTP_CODE_LENGTH}}$`).test(testCode)) return testCode;
  return String(randomInt(0, 10 ** PHONE_OTP_CODE_LENGTH)).padStart(PHONE_OTP_CODE_LENGTH, "0");
}

export function phoneOtpCodeHash(challengeId: string, digest: string, purpose: PhoneOtpPurpose, code: string) {
  return createHmac("sha256", otpSecret())
    .update(`${challengeId}:${digest}:${purpose}:${code}`)
    .digest("hex");
}

export function phoneOtpCodeMatches(expectedHash: string, challengeId: string, digest: string, purpose: PhoneOtpPurpose, code: string) {
  const actual = Buffer.from(phoneOtpCodeHash(challengeId, digest, purpose, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function verificationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPhoneVerificationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: verificationTokenHash(token) };
}

export async function consumePhoneVerification(
  tx: Prisma.TransactionClient,
  input: { phone: string; purpose: PhoneOtpPurpose; token: string },
) {
  const now = new Date();
  const result = await tx.phoneOtpChallenge.updateMany({
    where: {
      phoneHash: phoneHash(input.phone),
      purpose: input.purpose,
      verificationTokenHash: verificationTokenHash(input.token),
      verifiedAt: { not: null },
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });
  return result.count === 1;
}
