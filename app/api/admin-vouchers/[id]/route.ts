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

function voucherData(input: ReturnType<typeof voucherMutationSchema.parse>, immutableCode: string) {
  return {
    ...input,
    code: immutableCode,
    isActive: immutableCode === "WELCOME150" ? true : input.isActive,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: immutableCode === "WELCOME150" ? null : input.endsAt ? new Date(input.endsAt) : null,
  };
}

async function relationError(input: ReturnType<typeof voucherMutationSchema.parse>, effectiveCode: string) {
  if (input.serviceId) {
    const service = await db.service.findUnique({ where: { id: input.serviceId }, select: { isActive: true, isOnline: true } });
    if (!service) return "Dịch vụ áp dụng không còn tồn tại.";
    if ((input.isActive || effectiveCode === "WELCOME150") && (!service.isActive || !service.isOnline)) return "Hãy chọn dịch vụ đang nhận lịch hoặc tạm dừng voucher này.";
  }
  if (input.campaignId && !await db.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true } })) {
    return "Chiến dịch đã chọn không còn tồn tại.";
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem voucher." }, { status: 403 });
  const { id } = await params;
  const voucher = await db.voucher.findUnique({ where: { id }, include: voucherInclude });
  if (!voucher) return NextResponse.json({ error: "Không tìm thấy voucher." }, { status: 404 });
  return NextResponse.json({ voucher });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được sửa voucher." }, { status: 403 });
  const { id } = await params;
  const current = await db.voucher.findUnique({ where: { id }, include: voucherInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy voucher." }, { status: 404 });
  const parsed = voucherMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin voucher chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  const invalidRelation = await relationError(parsed.data, current.code);
  if (invalidRelation) return NextResponse.json({ error: invalidRelation }, { status: 400 });

  try {
    const voucher = await db.$transaction(async (tx) => {
      const updated = await tx.voucher.update({ where: { id }, data: voucherData(parsed.data, current.code), include: voucherInclude });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          action: "VOUCHER_UPDATE",
          entityType: "Voucher",
          entityId: id,
          before: current,
          after: updated,
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return updated;
    });
    revalidateTag("public-catalog", { expire: 0 });
    return NextResponse.json({ voucher });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Mã voucher này đã tồn tại." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được xóa voucher." }, { status: 403 });
  const { id } = await params;
  const current = await db.voucher.findUnique({ where: { id }, include: voucherInclude });
  if (!current) return NextResponse.json({ error: "Không tìm thấy voucher." }, { status: 404 });
  if (current.code === "WELCOME150") {
    return NextResponse.json({ error: "WELCOME150 là ưu đãi chào mừng cố định và không thể ngừng phát hành." }, { status: 409 });
  }

  const [bookingGroupReferences, officeEventReferences, officeRegistrationReferences] = await Promise.all([
    db.bookingGroup.count({ where: { voucherCode: { contains: current.code } } }),
    db.officeEvent.count({ where: { OR: [{ voucherCode: current.code }, { returnVoucherCode: current.code }] } }),
    db.officeRegistration.count({ where: { voucherCode: current.code } }),
  ]);
  const isSystemVoucher = ["WELCOME150", "AFF50", "RETURN100"].includes(current.code);
  const hasHistory = isSystemVoucher
    || current._count.usages > 0
    || current._count.bookings > 0
    || bookingGroupReferences > 0
    || officeEventReferences > 0
    || officeRegistrationReferences > 0;
  const result = await db.$transaction(async (tx) => {
    if (hasHistory) {
      const voucher = await tx.voucher.update({ where: { id }, data: { isActive: false }, include: voucherInclude });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          action: "VOUCHER_DEACTIVATE",
          entityType: "Voucher",
          entityId: id,
          before: current,
          after: voucher,
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return { voucher, mode: "SOFT_DELETE" as const };
    }
    await tx.voucher.delete({ where: { id } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        action: "VOUCHER_DELETE",
        entityType: "Voucher",
        entityId: id,
        before: current,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return { voucher: null, mode: "HARD_DELETE" as const };
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json(result);
}
