import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";
import { repairLegacyVisibleText } from "@/lib/server/text-safety";

const schema = z.object({ notificationId: z.string().trim().min(1).optional(), markAll: z.boolean().optional() }).refine((value) => value.notificationId || value.markAll);

export async function GET() {
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền xem thông báo Xgroup." }, { status: 403 });
  const notifications = await db.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    unreadCount: notifications.filter((item) => !item.readAt).length,
    notifications: notifications.map((item) => ({
      ...item,
      title: repairLegacyVisibleText(item.title),
      body: repairLegacyVisibleText(item.body),
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session) return NextResponse.json({ error: "Không có quyền cập nhật thông báo." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu cập nhật chưa hợp lệ." }, { status: 400 });
  const now = new Date();
  const result = await db.notification.updateMany({ where: parsed.data.markAll ? { userId: session.id, readAt: null } : { id: parsed.data.notificationId, userId: session.id }, data: { readAt: now } });
  return NextResponse.json({ updated: result.count });
}

