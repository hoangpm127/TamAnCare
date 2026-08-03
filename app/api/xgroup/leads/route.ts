import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageXgroupDistrict, requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";

const createSchema = z.object({
  leadCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{4,50}$/),
  districtId: z.string().trim().min(1),
  affiliateId: z.string().trim().min(1).nullable().optional(),
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().max(150).nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  officeAddress: z.string().trim().max(500).nullable().optional(),
  estimatedGmv: z.number().int().min(0).max(2_000_000_000),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().trim().min(1),
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "AWAITING_DEPOSIT", "SCHEDULED", "IN_SERVICE", "WON", "LOST"]).optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  lostReason: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền tạo cơ hội Business." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cơ hội chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  if (!(await canManageXgroupDistrict(session, parsed.data.districtId))) return NextResponse.json({ error: "Bạn không phụ trách địa bàn này." }, { status: 403 });
  if (parsed.data.affiliateId) {
    const affiliate = await db.businessAffiliate.findFirst({ where: { id: parsed.data.affiliateId, districtId: parsed.data.districtId, status: "ACTIVE" }, select: { id: true } });
    if (!affiliate) return NextResponse.json({ error: "Affiliate không hoạt động hoặc không thuộc địa bàn đã chọn." }, { status: 409 });
  }
  const input = parsed.data;
  const lead = await db.businessLead.create({ data: { ...input, affiliateId: input.affiliateId || null, contactName: input.contactName || null, contactPhone: input.contactPhone || null, contactEmail: input.contactEmail || null, officeAddress: input.officeAddress || null, nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null, nextAction: input.nextAction || null, note: input.note || null, ownerUserId: session.role === "DISTRICT_SALES_MANAGER" ? session.id : null } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_LEAD_CREATE", entityType: "BusinessLead", entityId: lead.id, after: { leadCode: lead.leadCode, districtId: lead.districtId, affiliateId: lead.affiliateId, estimatedGmv: lead.estimatedGmv } } });
  return NextResponse.json({ lead }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền cập nhật cơ hội Business." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });
  const before = await db.businessLead.findUnique({ where: { id: parsed.data.id } });
  if (!before) return NextResponse.json({ error: "Không tìm thấy cơ hội." }, { status: 404 });
  if (!(await canManageXgroupDistrict(session, before.districtId))) return NextResponse.json({ error: "Bạn không phụ trách cơ hội này." }, { status: 403 });
  const { id, nextActionAt, ...data } = parsed.data;
  if (data.stage === "LOST" && !data.lostReason?.trim()) return NextResponse.json({ error: "Cần ghi rõ lý do mất cơ hội." }, { status: 409 });
  const lead = await db.businessLead.update({ where: { id }, data: { ...data, nextActionAt: nextActionAt === undefined ? undefined : nextActionAt ? new Date(nextActionAt) : null, nextAction: data.nextAction === undefined ? undefined : data.nextAction || null, lostReason: data.lostReason === undefined ? undefined : data.lostReason || null, note: data.note === undefined ? undefined : data.note || null } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_LEAD_UPDATE", entityType: "BusinessLead", entityId: id, before: { stage: before.stage, nextActionAt: before.nextActionAt }, after: { stage: lead.stage, nextActionAt: lead.nextActionAt, lostReason: lead.lostReason } } });
  return NextResponse.json({ lead });
}

