import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { recordPackageLedger } from "@/lib/server/package-ledger";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const allowedRoles = ["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"] as const;
const schema = z.object({
  branchId: z.string().min(1).optional(),
  serviceId: z.string().min(1),
  therapistId: z.string().min(1).optional(),
  count: z.coerce.number().int().min(1).max(10).default(1),
  usedAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !allowedRoles.includes(session.role as (typeof allowedRoles)[number])) {
    return NextResponse.json({ error: "Bạn không có quyền ghi nhận lượt dùng tại quầy." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin lượt dùng chưa hợp lệ." }, { status: 400 });
  const { id } = await params;
  const input = parsed.data;
  const branchId = session.role === "OWNER" ? input.branchId : session.branchId;
  if (!branchId) return NextResponse.json({ error: "Hãy chọn cơ sở sử dụng gói." }, { status: 400 });
  const [branch, service, customerPackage, therapist] = await Promise.all([
    db.branch.findUnique({ where: { id: branchId } }),
    db.service.findUnique({ where: { id: input.serviceId } }),
    db.customerPackage.findUnique({ where: { id }, include: { packagePlan: true, customer: true } }),
    input.therapistId ? db.therapist.findUnique({ where: { id: input.therapistId }, include: { services: { select: { id: true } } } }) : null,
  ]);
  if (!branch) return NextResponse.json({ error: "Không tìm thấy cơ sở." }, { status: 404 });
  if (!service || !service.isActive) return NextResponse.json({ error: "Không tìm thấy dịch vụ đang hoạt động." }, { status: 404 });
  if (!customerPackage) return NextResponse.json({ error: "Không tìm thấy gói của khách." }, { status: 404 });
  const now = new Date();
  if (customerPackage.status !== "ACTIVE" || customerPackage.expiresAt < now || customerPackage.sessionsRemaining < input.count) {
    return NextResponse.json({ error: "Gói không còn đủ lượt khả dụng hoặc đã hết hiệu lực." }, { status: 409 });
  }
  const packageServiceId = customerPackage.serviceIdSnapshot ?? customerPackage.packagePlan.serviceId;
  if (packageServiceId && packageServiceId !== service.id) {
    return NextResponse.json({ error: "Dịch vụ này không thuộc quyền lợi của gói." }, { status: 409 });
  }
  if (therapist && (therapist.branchId !== branch.id || !therapist.services.some((item) => item.id === service.id))) {
    return NextResponse.json({ error: "Kỹ thuật viên không phục vụ dịch vụ này tại cơ sở đã chọn." }, { status: 409 });
  }
  const usedAt = input.usedAt ? new Date(input.usedAt) : now;

  const result = await db.$transaction(async (tx) => {
    const consumed = await tx.customerPackage.updateMany({
      where: { id, status: "ACTIVE", expiresAt: { gte: now }, sessionsRemaining: { gte: input.count } },
      data: { sessionsRemaining: { decrement: input.count } },
    });
    if (consumed.count !== 1) throw new Error("PACKAGE_BALANCE_CHANGED");
    const bookings = [];
    for (let index = 0; index < input.count; index += 1) {
      const booking = await tx.booking.create({
        data: {
          bookingCode: `PKG-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
          branchId: branch.id,
          customerId: customerPackage.customerId,
          serviceId: service.id,
          therapistId: therapist?.id,
          customerPackageId: customerPackage.id,
          startTime: usedAt,
          endTime: addMinutes(usedAt, service.durationMin),
          durationMin: service.durationMin,
          basePrice: service.basePrice,
          therapistFee: service.therapistFee,
          discountAmount: service.basePrice + service.therapistFee,
          totalAmount: 0,
          depositAmount: 0,
          paidAmount: 0,
          source: "COUNTER_PACKAGE_USE",
          note: input.note || "Lễ tân ghi nhận sử dụng Gói dài hạn tại quầy.",
          status: "COMPLETED",
          paymentStatus: "PAID",
          checkedInAt: usedAt,
          completedAt: usedAt,
        },
      });
      bookings.push(booking);
    }
    const nextRemaining = customerPackage.sessionsRemaining - input.count;
    if (nextRemaining === 0 && customerPackage.sessionsReserved === 0) {
      await tx.customerPackage.update({ where: { id }, data: { status: "USED_UP" } });
    }
    if (therapist) await tx.therapist.update({ where: { id: therapist.id }, data: { servedCount: { increment: input.count } } });
    await tx.customer.update({
      where: { id: customerPackage.customerId },
      data: { totalVisits: { increment: input.count }, lastVisitAt: usedAt, segment: "LONG_TERM" },
    });
    await recordPackageLedger(tx, {
      customerPackageId: customerPackage.id,
      packagePlanId: customerPackage.packagePlanId,
      customerId: customerPackage.customerId,
      branchId: branch.id,
      bookingId: bookings[0]?.id,
      event: "SESSION_USED",
      availableDelta: -input.count,
      usedDelta: input.count,
      description: `Dùng ${input.count} lượt tại quầy · ${service.name}`,
      metadata: { bookingIds: bookings.map((item) => item.id), actorUserId: session.id, offline: true },
      idempotencyKey: `package:counter:use:${customerPackage.id}:${crypto.randomUUID()}`,
      occurredAt: usedAt,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: branch.id,
        action: "CUSTOMER_PACKAGE_COUNTER_USE",
        entityType: "CustomerPackage",
        entityId: customerPackage.id,
        before: { sessionsRemaining: customerPackage.sessionsRemaining },
        after: { sessionsRemaining: nextRemaining, count: input.count, serviceId: service.id, bookingIds: bookings.map((item) => item.id) },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    await notifyCustomer(tx, customerPackage.customerId, {
      branchId: branch.id,
      type: "BOOKING",
      title: `Đã dùng ${input.count} lượt ${customerPackage.planNameSnapshot ?? customerPackage.packagePlan.name}`,
      body: `${service.name} · còn ${nextRemaining} lượt khả dụng. Không phát sinh thanh toán dịch vụ.`,
      actionUrl: "/toi",
    });
    return { bookings, remaining: nextRemaining };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error) => {
    if (error instanceof Error && error.message === "PACKAGE_BALANCE_CHANGED") return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "Số lượt vừa thay đổi. Hãy tải lại và thử lại." }, { status: 409 });
  return NextResponse.json({ persisted: true, remaining: result.remaining, bookingCodes: result.bookings.map((item) => item.bookingCode) }, { status: 201 });
}
