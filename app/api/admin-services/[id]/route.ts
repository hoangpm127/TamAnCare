import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceMutationSchema } from "@/lib/service-admin";
import { requireAdminSession } from "@/lib/server/admin-session";
import { privateIdentifierDigest, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const serviceInclude = {
  _count: { select: { bookings: true, packagePlans: true, therapists: true, vouchers: true } },
} as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const session = await requireAdminSession(["OWNER"]);
  if (!session) {
    return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được sửa dịch vụ." }, { status: 403 });
  }
  const { id } = await params;
  const current = await db.service.findUnique({ where: { id }, include: serviceInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
  const parsed = serviceMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin dịch vụ chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const service = await db.$transaction(async (tx) => {
    const updated = await tx.service.update({
      where: { id },
      data: {
        ...input,
        imageUrl: input.imageUrl || null,
        isOnline: input.isActive && input.isOnline,
      },
      include: serviceInclude,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "SERVICE_UPDATE",
        entityType: "Service",
        entityId: id,
        before: current,
        after: updated,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return updated;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ service });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const session = await requireAdminSession(["OWNER"]);
  if (!session) {
    return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được ngừng dịch vụ." }, { status: 403 });
  }
  const { id } = await params;
  const current = await db.service.findUnique({ where: { id }, include: serviceInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });

  const service = await db.$transaction(async (tx) => {
    const archived = await tx.service.update({
      where: { id },
      data: { isActive: false, isOnline: false },
      include: serviceInclude,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "SERVICE_DEACTIVATE",
        entityType: "Service",
        entityId: id,
        before: current,
        after: archived,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return archived;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ service, mode: "SOFT_DELETE" });
}
