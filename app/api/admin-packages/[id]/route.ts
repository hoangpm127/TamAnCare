import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { packageMutationSchema } from "@/lib/offer-admin";
import { requireAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const packageInclude = {
  _count: { select: { customerPacks: true } },
} as const;

function packageData(input: ReturnType<typeof packageMutationSchema.parse>) {
  return {
    ...input,
    description: input.description || null,
    badge: input.badge || null,
    sessions: input.paidSessions + input.bonusSessions,
  };
}

async function serviceError(input: ReturnType<typeof packageMutationSchema.parse>) {
  if (!input.serviceId) return null;
  const service = await db.service.findUnique({ where: { id: input.serviceId }, select: { isActive: true, isOnline: true } });
  if (!service) return "Dịch vụ áp dụng không còn tồn tại.";
  if (input.isActive && (!service.isActive || !service.isOnline)) return "Hãy chọn dịch vụ đang nhận lịch hoặc tạm dừng gói này.";
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem gói." }, { status: 403 });
  const { id } = await params;
  const plan = await db.packagePlan.findUnique({ where: { id }, include: packageInclude });
  if (!plan) return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
  return NextResponse.json({ package: plan });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được sửa gói." }, { status: 403 });
  const { id } = await params;
  const current = await db.packagePlan.findUnique({ where: { id }, include: packageInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });
  const parsed = packageMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin gói chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const invalidService = await serviceError(parsed.data);
  if (invalidService) return NextResponse.json({ error: invalidService }, { status: 400 });

  const plan = await db.$transaction(async (tx) => {
    const updated = await tx.packagePlan.update({ where: { id }, data: packageData(parsed.data), include: packageInclude });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "PACKAGE_PLAN_UPDATE",
        entityType: "PackagePlan",
        entityId: id,
        before: current,
        after: updated,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return updated;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ package: plan });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được xóa gói." }, { status: 403 });
  const { id } = await params;
  const current = await db.packagePlan.findUnique({ where: { id }, include: packageInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy gói." }, { status: 404 });

  const result = await db.$transaction(async (tx) => {
    if (current._count.customerPacks > 0) {
      const plan = await tx.packagePlan.update({ where: { id }, data: { isActive: false }, include: packageInclude });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          action: "PACKAGE_PLAN_DEACTIVATE",
          entityType: "PackagePlan",
          entityId: id,
          before: current,
          after: plan,
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return { package: plan, mode: "SOFT_DELETE" as const };
    }
    await tx.packagePlan.delete({ where: { id } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "PACKAGE_PLAN_DELETE",
        entityType: "PackagePlan",
        entityId: id,
        before: current,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return { package: null, mode: "HARD_DELETE" as const };
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json(result);
}
