import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type PackageStatus } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { recordPackageLedger } from "@/lib/server/package-ledger";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const allowedRoles = ["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"] as const;
const updateSchema = z.object({
  sessionsRemaining: z.coerce.number().int().min(0).max(10_000).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "PAUSED", "USED_UP"]).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Chưa có nội dung cần cập nhật." });

const include = {
  customer: { select: { id: true, fullName: true, phone: true } },
  packagePlan: { select: { id: true, name: true, price: true, sessions: true, serviceId: true, validityDays: true } },
  paymentTransaction: { select: { id: true, status: true, amount: true, method: true, paidAt: true, paymentCode: true } },
  ledgerEntries: {
    orderBy: [{ occurredAt: "desc" as const }, { id: "desc" as const }],
    take: 12,
    select: { id: true, event: true, availableDelta: true, reservedDelta: true, usedDelta: true, amount: true, description: true, occurredAt: true, booking: { select: { bookingCode: true } } },
  },
  _count: { select: { bookings: true, ledgerEntries: true } },
} satisfies Prisma.CustomerPackageInclude;

function serialize<T extends { expiresAt: Date; activatedAt: Date | null; createdAt: Date; updatedAt: Date; paymentTransaction: { paidAt: Date | null } | null; ledgerEntries: Array<{ occurredAt: Date }> }>(item: T) {
  return {
    ...item,
    expiresAt: item.expiresAt.toISOString(),
    activatedAt: item.activatedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    paymentTransaction: item.paymentTransaction ? { ...item.paymentTransaction, paidAt: item.paymentTransaction.paidAt?.toISOString() ?? null } : null,
    ledgerEntries: item.ledgerEntries.map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() })),
  };
}

async function authorizedSession() {
  const session = await getAdminSession();
  return session && !session.mustChangePassword && allowedRoles.includes(session.role as (typeof allowedRoles)[number]) ? session : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Bạn không có quyền sửa gói của khách." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });
  const { id } = await params;
  const current = await db.customerPackage.findUnique({ where: { id }, include: { packagePlan: true } });
  if (!current) return NextResponse.json({ error: "Không tìm thấy gói của khách." }, { status: 404 });
  const nextRemaining = parsed.data.sessionsRemaining ?? current.sessionsRemaining;
  if (nextRemaining + current.sessionsReserved > current.sessionsTotal) {
    return NextResponse.json({ error: `Tối đa ${current.sessionsTotal - current.sessionsReserved} lượt khả dụng vì ${current.sessionsReserved} lượt đang giữ cho lịch đã đặt.` }, { status: 409 });
  }
  const nextExpiry = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : current.expiresAt;
  let nextStatus = parsed.data.status ?? current.status;
  if (nextRemaining === 0 && current.sessionsReserved === 0) nextStatus = "USED_UP";
  else if (nextExpiry <= new Date()) nextStatus = "EXPIRED";
  else if (!parsed.data.status && (nextStatus === "USED_UP" || nextStatus === "EXPIRED")) nextStatus = "ACTIVE";
  if (nextStatus === "PAUSED" && current.sessionsReserved > 0) {
    return NextResponse.json({ error: "Không thể tạm dừng vì gói đang giữ lượt cho một lịch chưa hoàn tất." }, { status: 409 });
  }
  const availableDelta = nextRemaining - current.sessionsRemaining;
  const statusChanged = nextStatus !== current.status;
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const item = await tx.customerPackage.update({
      where: { id },
      data: {
        sessionsRemaining: nextRemaining,
        expiresAt: nextExpiry,
        status: nextStatus as PackageStatus,
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      },
    });
    if (availableDelta !== 0) {
      await recordPackageLedger(tx, {
        customerPackageId: item.id,
        packagePlanId: item.packagePlanId,
        customerId: item.customerId,
        branchId: session.branchId,
        event: "BALANCE_IMPORTED",
        availableDelta,
        description: `Điều chỉnh số lượt còn lại: ${current.sessionsRemaining} → ${nextRemaining}`,
        metadata: { actorUserId: session.id, previous: current.sessionsRemaining, next: nextRemaining },
        idempotencyKey: `package:balance:${item.id}:${crypto.randomUUID()}`,
        occurredAt: now,
      });
    }
    if (statusChanged || nextExpiry.getTime() !== current.expiresAt.getTime()) {
      await recordPackageLedger(tx, {
        customerPackageId: item.id,
        packagePlanId: item.packagePlanId,
        customerId: item.customerId,
        branchId: session.branchId,
        event: "STATUS_CHANGED",
        description: statusChanged ? `Đổi trạng thái ${current.status} → ${nextStatus}` : "Điều chỉnh hạn sử dụng gói",
        metadata: { actorUserId: session.id, previousStatus: current.status, nextStatus, previousExpiry: current.expiresAt.toISOString(), nextExpiry: nextExpiry.toISOString() },
        idempotencyKey: `package:status:${item.id}:${crypto.randomUUID()}`,
        occurredAt: now,
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: session.branchId,
        action: "CUSTOMER_PACKAGE_UPDATE",
        entityType: "CustomerPackage",
        entityId: item.id,
        before: { sessionsRemaining: current.sessionsRemaining, sessionsReserved: current.sessionsReserved, status: current.status, expiresAt: current.expiresAt.toISOString(), note: current.note },
        after: { sessionsRemaining: nextRemaining, sessionsReserved: current.sessionsReserved, status: nextStatus, expiresAt: nextExpiry.toISOString(), note: parsed.data.note ?? current.note },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    if (availableDelta !== 0 || statusChanged) {
      await notifyCustomer(tx, item.customerId, {
        branchId: session.branchId,
        type: "SYSTEM",
        title: `Gói ${current.planNameSnapshot ?? current.packagePlan.name} vừa được cập nhật`,
        body: `${nextRemaining} lượt còn dùng được · ${current.sessionsReserved} lượt đang giữ.`,
        actionUrl: "/toi",
      });
    }
    return tx.customerPackage.findUniqueOrThrow({ where: { id }, include });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return NextResponse.json({ package: serialize(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Bạn không có quyền tạm dừng gói của khách." }, { status: 403 });
  const { id } = await params;
  const current = await db.customerPackage.findUnique({ where: { id }, include: { packagePlan: true } });
  if (!current) return NextResponse.json({ error: "Không tìm thấy gói của khách." }, { status: 404 });
  if (current.sessionsReserved > 0) return NextResponse.json({ error: "Gói đang giữ lượt cho lịch đã đặt; hãy xử lý lịch trước khi tạm dừng." }, { status: 409 });
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const item = await tx.customerPackage.update({ where: { id }, data: { status: "PAUSED" } });
    await recordPackageLedger(tx, {
      customerPackageId: item.id,
      packagePlanId: item.packagePlanId,
      customerId: item.customerId,
      branchId: session.branchId,
      event: "STATUS_CHANGED",
      description: "Tạm dừng gói tại quầy",
      metadata: { actorUserId: session.id, previousStatus: current.status, nextStatus: "PAUSED" },
      idempotencyKey: `package:pause:${item.id}:${crypto.randomUUID()}`,
      occurredAt: now,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: session.branchId,
        action: "CUSTOMER_PACKAGE_PAUSE",
        entityType: "CustomerPackage",
        entityId: item.id,
        before: { status: current.status },
        after: { status: "PAUSED" },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return tx.customerPackage.findUniqueOrThrow({ where: { id }, include });
  });
  return NextResponse.json({ package: serialize(updated), mode: "SOFT_DELETE" });
}
