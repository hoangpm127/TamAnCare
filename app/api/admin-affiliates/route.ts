import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAffiliateReport } from "@/lib/server/admin-affiliate-report";
import { requireAdminSession } from "@/lib/server/admin-session";

const querySchema = z.object({
  period: z.enum(["today", "7d", "14d", "30d", "90d", "180d", "365d"]).default("30d"),
  paid: z.enum(["0", "1"]).default("0"),
});

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được xem đối soát Affiliate." }, { status: 403 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ period: url.searchParams.get("period") ?? undefined, paid: url.searchParams.get("paid") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Bộ lọc Affiliate chưa hợp lệ." }, { status: 400 });

  const report = await getAdminAffiliateReport({
    period: parsed.data.period,
    showPaid: parsed.data.paid === "1",
  });
  return NextResponse.json(report);
}
