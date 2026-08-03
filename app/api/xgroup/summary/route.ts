import { NextResponse } from "next/server";
import { getXgroupDashboard } from "@/lib/server/xgroup-dashboard";
import { requireXgroupSession } from "@/lib/server/xgroup-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Bạn không có quyền truy cập Trung tâm Xgroup." }, { status: 403 });
  const url = new URL(request.url);
  const data = await getXgroupDashboard(session, {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    districtId: url.searchParams.get("districtId"),
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

