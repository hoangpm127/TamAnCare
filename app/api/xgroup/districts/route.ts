import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,24}$/),
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120).default("Hà Nội"),
  annualGmvTarget: z.number().int().min(0).max(1_000_000_000_000),
  managerUserId: z.string().trim().min(1).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().trim().min(1), isActive: z.boolean().optional() });

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session || session.role !== "XGROUP_SUPER_ADMIN") return NextResponse.json({ error: "Chỉ Xgroup Super Admin được cấu hình địa bàn." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin địa bàn chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.managerUserId) {
    const manager = await db.user.findFirst({ where: { id: parsed.data.managerUserId, role: "DISTRICT_SALES_MANAGER", isActive: true }, select: { id: true } });
    if (!manager) return NextResponse.json({ error: "Tài khoản Trưởng phòng Quận không hợp lệ." }, { status: 409 });
  }
  const district = await db.businessDistrict.create({ data: { ...parsed.data, managerUserId: parsed.data.managerUserId || null, annualGmvTarget: BigInt(parsed.data.annualGmvTarget) } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_DISTRICT_CREATE", entityType: "BusinessDistrict", entityId: district.id, after: { code: district.code, name: district.name, managerUserId: district.managerUserId, annualGmvTarget: district.annualGmvTarget.toString() } } });
  return NextResponse.json({ district: { ...district, annualGmvTarget: Number(district.annualGmvTarget) } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session || session.role !== "XGROUP_SUPER_ADMIN") return NextResponse.json({ error: "Chỉ Xgroup Super Admin được sửa địa bàn." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });
  const { id, annualGmvTarget, managerUserId, ...rest } = parsed.data;
  const before = await db.businessDistrict.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Không tìm thấy địa bàn." }, { status: 404 });
  if (managerUserId) {
    const manager = await db.user.findFirst({ where: { id: managerUserId, role: "DISTRICT_SALES_MANAGER", isActive: true }, select: { id: true } });
    if (!manager) return NextResponse.json({ error: "Tài khoản Trưởng phòng Quận không hợp lệ." }, { status: 409 });
  }
  const district = await db.businessDistrict.update({ where: { id }, data: { ...rest, managerUserId: managerUserId === undefined ? undefined : managerUserId || null, annualGmvTarget: annualGmvTarget === undefined ? undefined : BigInt(annualGmvTarget) } });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: "XGROUP_DISTRICT_UPDATE", entityType: "BusinessDistrict", entityId: id, before: { code: before.code, name: before.name, managerUserId: before.managerUserId }, after: { code: district.code, name: district.name, managerUserId: district.managerUserId, isActive: district.isActive } } });
  return NextResponse.json({ district: { ...district, annualGmvTarget: Number(district.annualGmvTarget) } });
}

