import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation } from "@/lib/server/request-security";
import { repairLegacyVisibleText } from "@/lib/server/text-safety";

const updateSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
}).refine((value) => value.id || value.all, { message: "Cần chọn thông báo." });

function adminKind(type: string, branchId: string | null) {
  if (type === "BOOKING") return "booking";
  if (type === "PAYMENT" || type === "FINANCE") return "finance";
  if (type === "INVITATION" || type === "PROMOTION") return "vip";
  if (type === "REMINDER") return "branch";
  return branchId ? "branch" : "system";
}

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role === "INVESTOR") {
    return NextResponse.json({ error: "Bạn không có quyền xem thông báo vận hành." }, { status: 403 });
  }

  const notifications = await db.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    notifications: notifications.map((item) => ({
      id: item.id,
      kind: adminKind(item.type, item.branchId),
      title: repairLegacyVisibleText(item.title),
      body: repairLegacyVisibleText(item.body),
      href: item.actionUrl ?? "/admin",
      branchId: item.branchId ?? "system",
      createdAt: item.createdAt.toISOString(),
      read: Boolean(item.readAt),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role === "INVESTOR") {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật thông báo vận hành." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông báo chưa hợp lệ." }, { status: 400 });

  const where: Prisma.NotificationWhereInput = parsed.data.all
    ? { userId: session.id }
    : { id: parsed.data.id!, userId: session.id };
  const result = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ persisted: true, updated: result.count });
}
