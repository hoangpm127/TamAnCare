import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appRevision, appVersion } from "@/lib/server/app-version";
import {
  otpDeliveryAwaitingTemplateApproval,
  otpDeliveryConfigured,
  otpDeliveryTrackingConfigured,
  phoneVerificationRequired,
} from "@/lib/server/otp-delivery";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const [, maintenanceHeartbeat] = await Promise.all([
      db.$queryRaw`SELECT 1`,
      db.systemSetting.findUnique({
        where: { scopeKey: "GLOBAL:operations.maintenance_last_success_at" },
        select: { value: true },
      }),
    ]);
    const maintenanceAt = maintenanceHeartbeat?.value ? new Date(maintenanceHeartbeat.value) : null;
    const maintenanceAgeMinutes = maintenanceAt && !Number.isNaN(maintenanceAt.getTime())
      ? Math.round((Date.now() - maintenanceAt.getTime()) / 60_000)
      : null;
    const maintenanceReady = maintenanceAgeMinutes !== null
      && maintenanceAgeMinutes >= 0
      && maintenanceAgeMinutes <= 15;
    const requireMaintenance = process.env.APP_ENV === "production";
    const responseReady = maintenanceReady || !requireMaintenance;
    return NextResponse.json({
      status: maintenanceReady ? "ok" : "degraded",
      database: "ready",
      maintenance: maintenanceReady ? "ready" : "stale",
      maintenanceAgeMinutes,
      phoneVerification: phoneVerificationRequired()
        ? otpDeliveryAwaitingTemplateApproval()
          ? "pending-template"
          : otpDeliveryConfigured() && otpDeliveryTrackingConfigured() ? "ready" : "misconfigured"
        : "optional",
      version: appVersion(),
      revision: appRevision(),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    }, { status: responseReady ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("health.database_unavailable", error);
    return NextResponse.json({
      status: "unavailable",
      database: "unavailable",
      checkedAt: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
