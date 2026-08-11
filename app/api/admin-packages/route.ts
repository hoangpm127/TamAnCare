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

export async function GET() {
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem danh mục gói." }, { status: 403 });
  const packages = await db.packagePlan.findMany({ include: packageInclude, orderBy: [{ isActive: "desc" }, { price: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được thêm gói." }, { status: 403 });
  const parsed = packageMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin gói chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const invalidService = await serviceError(parsed.data);
  if (invalidService) return NextResponse.json({ error: invalidService }, { status: 400 });

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.packagePlan.create({ data: packageData(parsed.data), include: packageInclude });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "PACKAGE_PLAN_CREATE",
        entityType: "PackagePlan",
        entityId: created.id,
        after: created,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return created;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ package: plan }, { status: 201 });
}
