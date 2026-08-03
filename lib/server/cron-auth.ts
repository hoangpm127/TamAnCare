import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return process.env.NODE_ENV !== "production";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
