import "server-only";

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
};

function rateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_SECRET hoặc SESSION_SECRET chưa được cấu hình.");
  return "tam-an-local-rate-limit-secret";
}

export function privateIdentifierDigest(value: string) {
  return createHmac("sha256", rateLimitSecret()).update(value).digest("base64url");
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitIdentifier(request: Request, identity?: string) {
  return `${requestIp(request)}:${identity?.trim().toLowerCase() ?? "anonymous"}`;
}

export async function consumeRateLimit(options: RateLimitOptions) {
  const now = new Date();
  const key = `${options.scope}:${privateIdentifierDigest(options.identifier)}`;
  const existing = await db.rateLimitCounter.findUnique({ where: { key } });

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000)),
    };
  }

  const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() >= options.windowMs;
  if (windowExpired) {
    await db.rateLimitCounter.upsert({
      where: { key },
      create: { key, attempts: 1, windowStartedAt: now },
      update: { attempts: 1, windowStartedAt: now, blockedUntil: null },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const attempts = existing.attempts + 1;
  const allowed = attempts <= options.limit;
  const blockedUntil = allowed
    ? null
    : new Date(now.getTime() + (options.blockMs ?? options.windowMs));
  await db.rateLimitCounter.update({
    where: { key },
    data: { attempts: { increment: 1 }, blockedUntil },
  });
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((blockedUntil!.getTime() - now.getTime()) / 1000)),
  };
}

export async function clearRateLimit(scope: string, identifier: string) {
  const key = `${scope}:${privateIdentifierDigest(identifier)}`;
  await db.rateLimitCounter.deleteMany({ where: { key } });
}

/**
 * Cookie SameSite là lớp đầu tiên; kiểm tra Origin/Sec-Fetch-Site là lớp thứ hai
 * cho mọi request làm thay đổi dữ liệu từ trình duyệt.
 */
export function isSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return false;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  return origin === `${protocol}://${host}`;
}
