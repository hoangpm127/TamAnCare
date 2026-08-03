import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageXgroupDistrict, requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";

const baseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{4,32}$/),
  districtId: z.string().trim().min(1),
  displayName: z.string().trim().min(2).max(150),
  organization: z.string().trim().max(200).nullable().optional(),
  title: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  referrerProfile: z.string().trim().min(2).max(200),
  conflictDisclosureRequired: z.boolean().default(false),
  conflictDisclosureAccepted: z.boolean().default(false),
  complianceNote: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["PENDING_DUE_DILIGENCE", "ACTIVE", "PAUSED", "SUSPENDED"]).default("PENDING_DUE_DILIGENCE"),
});

const updateSchema = baseSchema.partial().extend({ id: z.string().trim().min(1) });

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền quản trị Affiliate Business." }, { status: 403 });
  const parsed = baseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Hồ sơ Affiliate chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  if (!(await canManageXgroupDistrict(session, parsed.data.districtId))) return NextResponse.json({ error: "Bạn không phụ trách địa bàn này." }, { status: 403 });
  const input = parsed.data;
  const forcedStatus = session.role === "XGROUP_SUPER_ADMIN" && (!input.conflictDisclosureRequired || input.conflictDisclosureAccepted) ? input.status : "PENDING_DUE_DILIGENCE";
  const affiliate = await db.businessAffiliate.create({
    data: {
      code: input.code,
      districtId: input.districtId,
      displayName: input.displayName,
      organization: input.organization || null,
      title: input.title || null,
      phone: input.phone || null,
      email: input.email || null,
      referrerProfile: input.referrerProfile,
      status: forcedStatus,
      commissionRateBps: 1000,
      conflictDisclosureRequired: input.conflictDisclosureRequired,
      conflictDisclosureAcceptedAt: input.conflictDisclosureAccepted ? new Date() : null,
      complianceNote: input.complianceNote || null,
      createdByUserId: session.id,
    },
  });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_AFFILIATE_CREATE", entityType: "BusinessAffiliate", entityId: affiliate.id, after: { code: affiliate.code, districtId: affiliate.districtId, status: affiliate.status, commissionRateBps: affiliate.commissionRateBps } } });
  return NextResponse.json({ affiliate }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền quản trị Affiliate Business." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Hồ sơ cập nhật chưa hợp lệ." }, { status: 400 });
  const before = await db.businessAffiliate.findUnique({ where: { id: parsed.data.id } });
  if (!before) return NextResponse.json({ error: "Không tìm thấy Affiliate." }, { status: 404 });
  const targetDistrict = parsed.data.districtId ?? before.districtId;
  if (!(await canManageXgroupDistrict(session, before.districtId)) || !(await canManageXgroupDistrict(session, targetDistrict))) return NextResponse.json({ error: "Bạn không phụ trách địa bàn này." }, { status: 403 });
  if (session.role !== "XGROUP_SUPER_ADMIN" && parsed.data.status && parsed.data.status !== "PENDING_DUE_DILIGENCE") return NextResponse.json({ error: "Trạng thái kích hoạt phải do Xgroup phê duyệt." }, { status: 403 });
  const nextConflictRequired = parsed.data.conflictDisclosureRequired ?? before.conflictDisclosureRequired;
  const nextConflictAccepted = parsed.data.conflictDisclosureAccepted === undefined
    ? Boolean(before.conflictDisclosureAcceptedAt)
    : parsed.data.conflictDisclosureAccepted;
  const nextStatus = parsed.data.status ?? before.status;
  if (nextStatus === "ACTIVE" && nextConflictRequired && !nextConflictAccepted) {
    return NextResponse.json({ error: "Affiliate phải hoàn tất công bố xung đột lợi ích trước khi kích hoạt." }, { status: 409 });
  }
  const { id, conflictDisclosureAccepted, ...data } = parsed.data;
  const affiliate = await db.businessAffiliate.update({
    where: { id },
    data: {
      ...data,
      organization: data.organization === undefined ? undefined : data.organization || null,
      title: data.title === undefined ? undefined : data.title || null,
      phone: data.phone === undefined ? undefined : data.phone || null,
      email: data.email === undefined ? undefined : data.email || null,
      complianceNote: data.complianceNote === undefined ? undefined : data.complianceNote || null,
      conflictDisclosureAcceptedAt: conflictDisclosureAccepted === undefined ? undefined : conflictDisclosureAccepted ? new Date() : null,
    },
  });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_AFFILIATE_UPDATE", entityType: "BusinessAffiliate", entityId: id, before: { districtId: before.districtId, status: before.status }, after: { districtId: affiliate.districtId, status: affiliate.status, conflictDisclosureAcceptedAt: affiliate.conflictDisclosureAcceptedAt } } });
  return NextResponse.json({ affiliate });
}

