import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { money, notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({
  decision: z.literal("REJECT"),
  reason: z.string().trim().min(10).max(500),
});

export async function POST(request: Request, context: { params: Promise<{ eventCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xử lý lịch Business." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vui lòng nhập lý do rõ ràng để thông báo cho khách hàng." }, { status: 400 });

  const { eventCode } = await context.params;
  const event = await db.officeEvent.findUnique({
    where: { eventCode },
    include: { payments: { where: { type: "DEPOSIT" }, orderBy: { createdAt: "desc" } } },
  });
  if (!event) return NextResponse.json({ error: "Không tìm thấy lịch Business." }, { status: 404 });
  if (session.role !== "OWNER" && session.branchId !== event.branchId) return NextResponse.json({ error: "Lịch không thuộc cơ sở bạn phụ trách." }, { status: 403 });
  if (!["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"].includes(event.status)) {
    return NextResponse.json({ error: "Lịch Business này đã được xử lý hoặc đang triển khai." }, { status: 409 });
  }

  const sourcePayment = event.payments[0];
  await db.$transaction(async (tx) => {
    await tx.officeEvent.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
    if (sourcePayment?.status === "PENDING") {
      await tx.paymentTransaction.update({ where: { id: sourcePayment.id }, data: { status: "VOID", note: parsed.data.reason } });
    }
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: event.branchId,
        action: "BUSINESS_BOOKING_REJECT",
        entityType: "OfficeEvent",
        entityId: event.id,
        before: { status: event.status },
        after: { status: "CANCELLED", reason: parsed.data.reason },
      },
    });
    if (event.customerId) {
      await notifyCustomer(tx, event.customerId, {
        branchId: event.branchId,
        type: "BOOKING",
        title: `Cần điều chỉnh lịch Business · ${event.companyName}`,
        body: `${parsed.data.reason}${event.paidAmount > 0 ? ` Khoản cọc ${money(event.paidAmount)} được chuyển sang quy trình hoàn/đổi lịch.` : ""}`,
        actionUrl: `/doanh-nghiep/${event.eventCode}`,
      });
    }
    await notifyOperations(tx, {
      branchId: event.branchId,
      audience: "MANAGEMENT",
      type: event.paidAmount > 0 ? "FINANCE" : "BOOKING",
      title: `Đã từ chối lịch Business · ${event.companyName}`,
      body: `${session.displayName}: ${parsed.data.reason}${event.paidAmount > 0 ? ` · Cần xử lý khoản cọc ${money(event.paidAmount)}.` : ""}`,
      actionUrl: `/admin/business/${event.eventCode}`,
    });
  });
  return NextResponse.json({ persisted: true, event: { eventCode: event.eventCode, status: "CANCELLED" } });
}
