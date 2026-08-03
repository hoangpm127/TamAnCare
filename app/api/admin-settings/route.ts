import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { settingValueError } from "@/lib/server/system-setting-validation";

const categorySchema = z.enum(["CHAT", "BOOKING", "NOTIFICATION", "FINANCE", "SECURITY", "OPERATIONS", "CRM", "BUSINESS"]);
const valueTypeSchema = z.enum(["TEXT", "BOOLEAN", "NUMBER", "PERCENT", "MINUTES", "DAYS", "TIME", "DATETIME", "JSON"]);
const createSchema = z.object({
  key: z.string().trim().min(3).max(80).regex(/^[a-z0-9._-]+$/),
  category: categorySchema,
  label: z.string().trim().min(3).max(100),
  value: z.string().trim().max(8_000),
  valueType: valueTypeSchema.default("TEXT"),
  description: z.string().trim().max(500).optional(),
  branchId: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().default(true),
});

function scopeKey(key: string, branchId: string | null) {
  return `${branchId ?? "GLOBAL"}:${key}`;
}

export async function GET() {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem cấu hình hệ thống." }, { status: 403 });
  const settings = await db.systemSetting.findMany({
    where: session.role === "OWNER" ? {} : { OR: [{ branchId: null }, { branchId: session.branchId }] },
    orderBy: [{ category: "asc" }, { branchId: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền thêm cấu hình." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cấu hình chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const valueError = settingValueError(parsed.data.valueType, parsed.data.value);
  if (valueError) return NextResponse.json({ error: valueError }, { status: 400 });
  const branchId = session.role === "OWNER" ? (parsed.data.branchId || null) : session.branchId;
  if (session.role !== "OWNER" && !branchId) return NextResponse.json({ error: "Tài khoản chưa được gán cơ sở." }, { status: 409 });
  try {
    const setting = await db.systemSetting.create({ data: { ...parsed.data, branchId, scopeKey: scopeKey(parsed.data.key, branchId), description: parsed.data.description || null } });
    await db.adminAuditLog.create({ data: { actorUserId: session.id, branchId, action: "SYSTEM_SETTING_CREATE", entityType: "SystemSetting", entityId: setting.id, after: setting, ipHash: privateIdentifierDigest(requestIp(request)) } });
    return NextResponse.json({ setting }, { status: 201 });
  } catch (error) {
    console.error("admin_setting.create_failed", error);
    return NextResponse.json({ error: "Khóa cấu hình đã tồn tại trong phạm vi này." }, { status: 409 });
  }
}
