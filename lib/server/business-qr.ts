import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type BusinessQrPayload = {
  eventCode: string;
  leadTherapistId: string;
  version: number;
};

function secret() {
  const value = process.env.BUSINESS_QR_SECRET ?? process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("BUSINESS_QR_SECRET hoặc SESSION_SECRET chưa được cấu hình.");
  }
  return value ?? "tam-an-business-local-development-only";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(`tam-an-business:${payload}`).digest("base64url");
}

export function createBusinessQrToken(payload: BusinessQrPayload) {
  const compact = Buffer.from(JSON.stringify({ e: payload.eventCode, t: payload.leadTherapistId, v: payload.version })).toString("base64url");
  return `${compact}.${signature(compact)}`;
}

export function verifyBusinessQrToken(token: string): BusinessQrPayload | null {
  const [compact, provided, extra] = token.split(".");
  if (!compact || !provided || extra) return null;
  const expected = signature(compact);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(compact, "base64url").toString("utf8")) as { e?: unknown; t?: unknown; v?: unknown };
    if (typeof decoded.e !== "string" || typeof decoded.t !== "string" || !Number.isSafeInteger(decoded.v) || Number(decoded.v) < 1) return null;
    return { eventCode: decoded.e, leadTherapistId: decoded.t, version: Number(decoded.v) };
  } catch {
    return null;
  }
}

export function businessScanUrl(token: string, origin?: string) {
  const path = `/business/scan/${encodeURIComponent(token)}`;
  if (origin) return new URL(path, origin).toString();
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? new URL(path, configured).toString() : path;
}
