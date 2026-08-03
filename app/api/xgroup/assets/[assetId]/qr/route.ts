import QRCode from "qrcode";
import { db } from "@/lib/db";
import { canManageXgroupDistrict, requireXgroupSession } from "@/lib/server/xgroup-access";

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const session = await requireXgroupSession();
  if (!session) return new Response("Forbidden", { status: 403 });
  const { assetId } = await params;
  const asset = await db.businessMediaAsset.findUnique({ where: { id: assetId }, select: { id: true, code: true, districtId: true } });
  if (!asset || !(await canManageXgroupDistrict(session, asset.districtId))) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const buffer = await QRCode.toBuffer(`${origin}/xg-ref/${encodeURIComponent(asset.code)}`, { width: 720, margin: 2, errorCorrectionLevel: "H", color: { dark: "#172e2a", light: "#ffffff" } });
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${asset.code}.png"` } });
}
