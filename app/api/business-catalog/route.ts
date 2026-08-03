import { NextResponse } from "next/server";
import { getBusinessCatalog } from "@/lib/server/business-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBusinessCatalog(), {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
  });
}
