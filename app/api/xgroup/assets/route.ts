import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageXgroupDistrict, requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";

const baseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{4,32}$/),
  districtId: z.string().trim().min(1).nullable().optional(),
  affiliateId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(["LINK", "QR", "VIDEO"]),
  title: z.string().trim().min(2).max(180),
  destinationPath: z.string().trim().regex(/^\/(doanh-nghiep|booking)(?:[/?#].*)?$/),
  videoUrl: z.string().trim().url().refine((value) => value.startsWith("https://"), "Video phải dùng HTTPS.").nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
});

const updateSchema = baseSchema.partial().extend({ id: z.string().trim().min(1) });

async function resolveDistrict(input: { districtId?: string | null; affiliateId?: string | null }) {
  const affiliate = input.affiliateId ? await db.businessAffiliate.findUnique({ where: { id: input.affiliateId }, select: { id: true, districtId: true, status: true } }) : null;
  if (input.affiliateId && !affiliate) return { error: "Affiliate không tồn tại.", districtId: null, affiliateStatus: null };
  if (affiliate && input.districtId && affiliate.districtId !== input.districtId) return { error: "Affiliate không thuộc địa bàn đã chọn.", districtId: null, affiliateStatus: affiliate.status };
  return { error: null, districtId: input.districtId ?? affiliate?.districtId ?? null, affiliateStatus: affiliate?.status ?? null };
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền quản trị kho nội dung." }, { status: 403 });
  const parsed = baseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin tài sản truyền thông chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const resolved = await resolveDistrict(parsed.data);
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 409 });
  if (!resolved.districtId || !(await canManageXgroupDistrict(session, resolved.districtId))) return NextResponse.json({ error: "Tài sản phải thuộc địa bàn bạn được phân quyền." }, { status: 403 });
  if (parsed.data.status === "ACTIVE" && parsed.data.affiliateId && resolved.affiliateStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Chỉ được kích hoạt tài sản của Affiliate đang hoạt động." }, { status: 409 });
  }
  const asset = await db.businessMediaAsset.create({ data: { ...parsed.data, districtId: resolved.districtId, affiliateId: parsed.data.affiliateId || null, videoUrl: parsed.data.videoUrl || null, createdByUserId: session.id } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_ASSET_CREATE", entityType: "BusinessMediaAsset", entityId: asset.id, after: { code: asset.code, type: asset.type, districtId: asset.districtId, affiliateId: asset.affiliateId, status: asset.status } } });
  return NextResponse.json({ asset, trackingPath: `/xg-ref/${encodeURIComponent(asset.code)}` }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền quản trị kho nội dung." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });
  const before = await db.businessMediaAsset.findUnique({ where: { id: parsed.data.id } });
  if (!before) return NextResponse.json({ error: "Không tìm thấy tài sản." }, { status: 404 });
  if (!(await canManageXgroupDistrict(session, before.districtId))) return NextResponse.json({ error: "Bạn không phụ trách tài sản này." }, { status: 403 });
  const resolved = await resolveDistrict({ districtId: parsed.data.districtId === undefined ? before.districtId : parsed.data.districtId, affiliateId: parsed.data.affiliateId === undefined ? before.affiliateId : parsed.data.affiliateId });
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 409 });
  if (!resolved.districtId || !(await canManageXgroupDistrict(session, resolved.districtId))) return NextResponse.json({ error: "Địa bàn không thuộc phạm vi của bạn." }, { status: 403 });
  const targetAffiliateId = parsed.data.affiliateId === undefined ? before.affiliateId : parsed.data.affiliateId;
  const targetStatus = parsed.data.status ?? before.status;
  if (targetStatus === "ACTIVE" && targetAffiliateId && resolved.affiliateStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Chỉ được kích hoạt tài sản của Affiliate đang hoạt động." }, { status: 409 });
  }
  const { id, ...data } = parsed.data;
  const asset = await db.businessMediaAsset.update({ where: { id }, data: { ...data, districtId: resolved.districtId, affiliateId: data.affiliateId === undefined ? undefined : data.affiliateId || null, videoUrl: data.videoUrl === undefined ? undefined : data.videoUrl || null } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_ASSET_UPDATE", entityType: "BusinessMediaAsset", entityId: id, before: { status: before.status, districtId: before.districtId }, after: { status: asset.status, districtId: asset.districtId, qrVersion: asset.qrVersion } } });
  return NextResponse.json({ asset, trackingPath: `/xg-ref/${encodeURIComponent(asset.code)}` });
}
