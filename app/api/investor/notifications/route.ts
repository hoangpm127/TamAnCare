import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

const updateSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
}).refine((value) => value.id || value.all, { message: "Cần chọn thông báo." });

export async function GET() {
  const session = await requireAdminSession(["INVESTOR"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem thông báo đầu tư." }, { status: 403 });

  const notifications = await db.notification.findMany({
    where: { userId: session.id, type: { in: ["FINANCE", "PROMOTION", "SYSTEM"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    notifications: notifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      actionUrl: item.actionUrl,
      branchId: item.branchId,
      createdAt: item.createdAt.toISOString(),
      read: Boolean(item.readAt),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["INVESTOR"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền cập nhật thông báo đầu tư." }, { status: 403 });

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông báo chưa hợp lệ." }, { status: 400 });

  const where: Prisma.NotificationWhereInput = parsed.data.all
    ? { userId: session.id, type: { in: ["FINANCE", "PROMOTION", "SYSTEM"] } }
    : { id: parsed.data.id!, userId: session.id };
  const result = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ persisted: true, updated: result.count });
}
