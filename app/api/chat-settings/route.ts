import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const setting = await db.systemSetting.findUnique({ where: { scopeKey: "GLOBAL:assistant.enabled" } });
  return NextResponse.json({ enabled: setting ? setting.isActive && setting.value === "true" : true });
}
