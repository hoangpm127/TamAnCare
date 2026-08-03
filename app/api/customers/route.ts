import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  branchId: z.string().min(1),
  relationship: z.enum(["WALK_IN", "FRIEND", "BOSS", "PARTNER"]),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role === "INVESTOR" || session.role === "THERAPIST") return NextResponse.json({ error: "Bạn không có quyền xem CRM." }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);
  const customers = await db.customer.findMany({
    where: session.role === "OWNER" ? {} : {
      OR: [
        { bookings: { some: { branchId: session.branchId ?? "__none__" } } },
        { firstSource: { endsWith: `:${session.branchId ?? "__none__"}` } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      favoriteTherapist: true,
      packages: { where: { status: "ACTIVE" }, include: { packagePlan: true } },
      bookings: {
        where: session.role === "OWNER" ? {} : { branchId: session.branchId ?? undefined },
        orderBy: { startTime: "desc" },
        take: 5,
        include: { branch: true, service: true, therapist: true },
      },
    },
  });
  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ Admin, Quản lý hoặc Lễ tân được tạo hồ sơ khách." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông tin khách hàng chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (session.role !== "OWNER" && input.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được tiếp nhận khách tại cơ sở mình phụ trách." }, { status: 403 });
  }
  const branch = await db.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) return NextResponse.json({ error: "Không tìm thấy cơ sở tiếp nhận." }, { status: 404 });

  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.upsert({
      where: { phone: input.phone.replace(/\s+/g, "") },
      create: {
        fullName: input.fullName,
        phone: input.phone.replace(/\s+/g, ""),
        firstSource: `CRM_${input.relationship}:${input.branchId}`,
        internalNote: input.note,
        commonIssues: [],
      },
      update: {
        fullName: input.fullName,
        firstSource: `CRM_${input.relationship}:${input.branchId}`,
        internalNote: input.note || undefined,
      },
    });
    await notifyCustomer(tx, created.id, {
      branchId: input.branchId,
      type: "SYSTEM",
      title: `${branch.name.replace(/^Tâm An Center · /, "")} đã tiếp nhận hồ sơ của bạn`,
      body: input.note ? "Ghi chú chăm sóc đã được chuyển tới đội ngũ vận hành." : "Đội ngũ đã sẵn sàng hỗ trợ bạn đặt lịch phù hợp.",
      actionUrl: "/booking",
    });
    await notifyOperations(tx, {
      branchId: input.branchId,
      type: input.relationship === "PARTNER" ? "INVITATION" : "SYSTEM",
      title: `CRM mới · ${created.fullName}`,
      body: `${created.phone} · ${input.relationship === "WALK_IN" ? "Khách đến trực tiếp" : input.relationship === "FRIEND" ? "Bạn giới thiệu" : input.relationship === "BOSS" ? "Mời sếp/đồng nghiệp" : "Đối tác/Affiliate"}.`,
      actionUrl: "/admin/customers",
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: input.branchId,
        action: "CRM_CUSTOMER_UPSERT",
        entityType: "Customer",
        entityId: created.id,
        after: {
          fullName: created.fullName,
          phoneMasked: `${created.phone.slice(0, 3)}***${created.phone.slice(-3)}`,
          relationship: input.relationship,
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return created;
  });
  return NextResponse.json({ persisted: true, customer }, { status: 201 });
}
