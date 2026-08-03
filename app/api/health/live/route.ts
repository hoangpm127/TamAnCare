import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appRevision, appVersion } from "@/lib/server/app-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ready",
      version: appVersion(),
      revision: appRevision(),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("health.liveness_database_unavailable", error);
    return NextResponse.json({
      status: "unavailable",
      database: "unavailable",
      checkedAt: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
