import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeRateLimit, requestIp } from "@/lib/server/request-security";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const asset = await db.businessMediaAsset.findFirst({
    where: {
      code: code.toUpperCase(),
      status: "ACTIVE",
      OR: [{ affiliateId: null }, { affiliate: { is: { status: "ACTIVE" } } }],
    },
    select: { id: true, code: true, destinationPath: true },
  });
  if (!asset) return NextResponse.redirect(new URL("/doanh-nghiep", request.url));
  const rate = await consumeRateLimit({ scope: "xgroup-asset-click", identifier: `${requestIp(request)}:${asset.id}`, limit: 60, windowMs: 60 * 60_000 });
  if (rate.allowed) await db.businessMediaAsset.update({ where: { id: asset.id }, data: { clickCount: { increment: 1 } } });
  const destination = new URL(asset.destinationPath, request.url);
  destination.searchParams.set("ref", asset.code);
  return NextResponse.redirect(destination, 307);
}

