import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE_NAME = "tt_guest_session_v1";
const SESSION_DAYS = 180;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function secureCookie() {
  return process.env.SESSION_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.SESSION_COOKIE_SECURE === "true";
}

function expiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function getGuestSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return db.guestSession.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
  });
}

export async function ensureGuestSession() {
  const current = await getGuestSession();
  if (current) {
    if (Date.now() - current.lastSeenAt.getTime() > 24 * 60 * 60 * 1000) {
      await db.guestSession.update({ where: { id: current.id }, data: { lastSeenAt: new Date() } });
    }
    return current;
  }

  const token = randomBytes(32).toString("base64url");
  const expiry = expiresAt();
  const session = await db.guestSession.create({
    data: { tokenHash: hashToken(token), expiresAt: expiry },
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    expires: expiry,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
    priority: "high",
  });
  return session;
}

export async function hasGuestBookingAccess(input: { guestSessionId: string; bookingGroupId?: string; bookingId?: string }) {
  return Boolean(await db.bookingAccessGrant.findFirst({
    where: {
      guestSessionId: input.guestSessionId,
      expiresAt: { gt: new Date() },
      ...(input.bookingGroupId ? { bookingGroupId: input.bookingGroupId } : { bookingId: input.bookingId }),
    },
    select: { id: true },
  }));
}
