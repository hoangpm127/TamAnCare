import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

const COOKIE_NAME = "ta_customer_session_v2";
const LEGACY_COOKIE_NAME = "ta_customer_session";
const SESSION_DAYS = 30;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expiresAt: Date) {
  const secure = process.env.SESSION_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.SESSION_COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
    priority: "high" as const,
  };
}

export async function createCustomerSession(customerId: string) {
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.customerSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    db.customerSession.create({ data: { customerId, tokenHash: tokenHash(token), expiresAt } }),
  ]);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, cookieOptions(expiresAt));
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

export async function getCustomerSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      account: {
        include: {
          customer: { include: { oauthIdentities: { where: { customerId: { not: null } } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.account;
}

export async function deleteCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

type CustomerAccountDtoInput = {
  customerId: string;
  phone: string;
  phoneVerifiedAt: Date | null;
  creditBalance: number;
  freeConsultationEligible: boolean;
  freeConsultationDecision: "INTERESTED" | "DECLINED" | null;
  freeConsultationRespondedAt: Date | null;
  customer: {
    fullName: string;
    totalVisits: number;
    oauthIdentities?: Array<{ provider: "GOOGLE" | "FACEBOOK" }>;
  };
};

export function customerAccountDto(account: CustomerAccountDtoInput) {
  return {
    customerId: account.customerId,
    fullName: account.customer.fullName,
    phone: account.phone,
    phoneVerified: Boolean(account.phoneVerifiedAt),
    totalVisits: account.customer.totalVisits,
    creditBalance: account.creditBalance,
    welcomeCreditAvailable: account.creditBalance > 0 && (Boolean(account.phoneVerifiedAt) || !phoneVerificationRequired()),
    oauthProviders: account.customer.oauthIdentities?.map((identity) => identity.provider) ?? [],
    freeConsultationPrompt: {
      eligible: account.freeConsultationEligible && account.freeConsultationDecision === null,
      decision: account.freeConsultationDecision,
      respondedAt: account.freeConsultationRespondedAt?.toISOString() ?? null,
    },
  };
}
