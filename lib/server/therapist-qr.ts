import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type TherapistQrPayload = { therapistId: string; branchId: string; version: number };

function secret() {
  const value = process.env.THERAPIST_QR_SECRET ?? process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("THERAPIST_QR_SECRET hoặc SESSION_SECRET chưa được cấu hình.");
  }
  return value ?? "tam-an-therapist-local-development-only";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(`tam-an-therapist:${payload}`).digest("base64url");
}

export function createTherapistQrToken(payload: TherapistQrPayload) {
  const compact = Buffer.from(JSON.stringify({ t: payload.therapistId, b: payload.branchId, v: payload.version })).toString("base64url");
  return `${compact}.${signature(compact)}`;
}

export function verifyTherapistQrToken(token: string): TherapistQrPayload | null {
  const [compact, provided, extra] = token.split(".");
  if (!compact || !provided || extra) return null;
  const expectedBuffer = Buffer.from(signature(compact));
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(compact, "base64url").toString("utf8")) as { t?: unknown; b?: unknown; v?: unknown };
    if (typeof decoded.t !== "string" || typeof decoded.b !== "string" || !Number.isSafeInteger(decoded.v) || Number(decoded.v) < 1) return null;
    return { therapistId: decoded.t, branchId: decoded.b, version: Number(decoded.v) };
  } catch {
    return null;
  }
}

export function therapistCheckinUrl(token: string, origin?: string) {
  const path = `/check-in?ktv=${encodeURIComponent(token)}`;
  if (origin) return new URL(path, origin).toString();
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? new URL(path, configured).toString() : path;
}
