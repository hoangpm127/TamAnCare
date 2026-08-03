import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { settingValueError } from "@/lib/server/system-setting-validation";

const updateSchema = z.object({
  key: z.string().trim().min(3).max(80).regex(/^[a-z0-9._-]+$/).optional(),
  category: z.enum(["CHAT", "BOOKING", "NOTIFICATION", "FINANCE", "SECURITY", "OPERATIONS", "CRM", "BUSINESS"]).optional(),
  label: z.string().trim().min(3).max(100).optional(),
  value: z.string().trim().max(8_000).optional(),
  valueType: z.enum(["TEXT", "BOOLEAN", "NUMBER", "PERCENT", "MINUTES", "DAYS", "TIME", "DATETIME", "JSON"]).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  branchId: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});

function scopeKey(key: string, branchId: string | null) {
  return `${branchId ?? "GLOBAL"}:${key}`;
}

async function authorizedSetting(id: string) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return { session: null, setting: null };
  const setting = await db.systemSetting.findUnique({ where: { id } });
  if (!setting) return { session, setting: null };
  if (session.role !== "OWNER" && setting.branchId !== session.branchId) return { session, setting: null };
  return { session, setting };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const { id } = await context.params;
  const { session, setting } = await authorizedSetting(id);
  if (!session || !setting) return NextResponse.json({ error: "Không tìm thấy cấu hình trong phạm vi được cấp." }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cấu hình chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const valueType = parsed.data.valueType ?? setting.valueType;
  const value = parsed.data.value ?? setting.value;
  const valueError = settingValueError(valueType, value);
  if (valueError) return NextResponse.json({ error: valueError }, { status: 400 });
  const branchId = session.role === "OWNER" ? (parsed.data.branchId === undefined ? setting.branchId : parsed.data.branchId) : session.branchId;
  const key = parsed.data.key ?? setting.key;
  try {
    const updated = await db.systemSetting.update({
      where: { id },
      data: { ...parsed.data, branchId, scopeKey: scopeKey(key, branchId), description: parsed.data.description === "" ? null : parsed.data.description },
    });
    await db.adminAuditLog.create({ data: { actorUserId: session.id, branchId, action: "SYSTEM_SETTING_UPDATE", entityType: "SystemSetting", entityId: id, before: setting, after: updated, ipHash: privateIdentifierDigest(requestIp(request)) } });
    return NextResponse.json({ setting: updated });
  } catch (error) {
    console.error("admin_setting.update_failed", error);
    return NextResponse.json({ error: "Không thể cập nhật; khóa cấu hình có thể đã tồn tại." }, { status: 409 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const { id } = await context.params;
  const { session, setting } = await authorizedSetting(id);
  if (!session || !setting) return NextResponse.json({ error: "Không tìm thấy cấu hình trong phạm vi được cấp." }, { status: 404 });
  await db.$transaction([
    db.adminAuditLog.create({ data: { actorUserId: session.id, branchId: setting.branchId, action: "SYSTEM_SETTING_DELETE", entityType: "SystemSetting", entityId: id, before: setting, ipHash: privateIdentifierDigest(requestIp(request)) } }),
    db.systemSetting.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
