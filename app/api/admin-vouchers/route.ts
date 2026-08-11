import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { voucherMutationSchema } from "@/lib/offer-admin";
import { requireAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const voucherInclude = {
  _count: { select: { usages: true, bookings: true } },
} as const;

function voucherData(input: ReturnType<typeof voucherMutationSchema.parse>) {
  return {
    ...input,
    isActive: input.code === "WELCOME150" ? true : input.isActive,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.code === "WELCOME150" ? null : input.endsAt ? new Date(input.endsAt) : null,
  };
}

async function relationError(input: ReturnType<typeof voucherMutationSchema.parse>) {
  if (input.serviceId) {
    const service = await db.service.findUnique({ where: { id: input.serviceId }, select: { isActive: true, isOnline: true } });
    if (!service) return "Dịch vụ áp dụng không còn tồn tại.";
    if ((input.isActive || input.code === "WELCOME150") && (!service.isActive || !service.isOnline)) return "Hãy chọn dịch vụ đang nhận lịch hoặc tạm dừng voucher này.";
  }
  if (input.campaignId && !await db.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true } })) {
    return "Chiến dịch đã chọn không còn tồn tại.";
  }
  return null;
}

export async function GET() {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem danh mục voucher." }, { status: 403 });
  const vouchers = await db.voucher.findMany({ include: voucherInclude, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ vouchers });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được thêm voucher." }, { status: 403 });
  const parsed = voucherMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin voucher chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const invalidRelation = await relationError(parsed.data);
  if (invalidRelation) return NextResponse.json({ error: invalidRelation }, { status: 400 });

  try {
    const voucher = await db.$transaction(async (tx) => {
      const created = await tx.voucher.create({ data: voucherData(parsed.data), include: voucherInclude });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          action: "VOUCHER_CREATE",
          entityType: "Voucher",
          entityId: created.id,
          after: created,
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return created;
    });
    revalidateTag("public-catalog", { expire: 0 });
    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Mã voucher này đã tồn tại." }, { status: 409 });
    }
    throw error;
  }
}
