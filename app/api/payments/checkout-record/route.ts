import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { buildPaymentCode, confirmIncomingPayment, PaymentReconciliationError } from "@/lib/server/payment-service";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  bookingCode: z.string().trim().min(8),
  actualAmount: z.coerce.number().int().positive(),
  method: z.enum(["CASH", "CARD_POS", "BANK_TRANSFER_MANUAL"]),
  externalReference: z.string().trim().min(4).max(120).optional(),
  note: z.string().trim().min(3).max(500),
});

class CheckoutRecordError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin, Quản lý hoặc Lễ tân cơ sở được xác nhận thanh toán tại quầy." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin thanh toán tại quầy chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const rateLimit = await consumeRateLimit({ scope: "checkout-record", identifier: session.id, limit: 80, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã thao tác quá nhiều lần; vui lòng kiểm tra sổ trước khi tiếp tục." }, { status: 429 });

  try {
    const result = await db.$transaction(async (tx) => {
      const direct = await tx.booking.findUnique({ where: { bookingCode: parsed.data.bookingCode }, include: { group: true } });
      const group = direct?.group ?? await tx.bookingGroup.findUnique({ where: { referenceCode: parsed.data.bookingCode } });
      const groupId = group?.id ?? direct?.groupId;
      const bookings = groupId
        ? await tx.booking.findMany({ where: { groupId }, orderBy: { startTime: "asc" } })
        : direct
          ? [direct]
          : [];
      if (!bookings.length) throw new CheckoutRecordError("Không tìm thấy booking.", 404);
      const branchId = group?.branchId ?? bookings[0].branchId;
      if (session.role !== "OWNER" && session.branchId !== branchId) {
        throw new CheckoutRecordError("Bạn không có quyền ghi nhận giao dịch ngoài cơ sở phụ trách.", 403);
      }
      const status = group?.status ?? bookings[0].status;
      if (!["CHECKED_IN", "IN_SERVICE"].includes(status)) {
        throw new CheckoutRecordError("Chỉ ghi nhận phần còn lại khi khách đã check-in dịch vụ.", 409);
      }
      const totalAmount = group?.totalAmount ?? bookings.reduce((sum, item) => sum + item.totalAmount, 0);
      const paidAmount = group?.paidAmount ?? bookings.reduce((sum, item) => sum + item.paidAmount, 0);
      const dueAmount = Math.max(0, totalAmount - Math.min(totalAmount, paidAmount));
      if (parsed.data.actualAmount !== dueAmount) {
        throw new CheckoutRecordError(
          `Chỉ ghi nhận đúng số tiền Bill còn lại ${dueAmount.toLocaleString("vi-VN")}đ. Tip tùy tâm khách trao trực tiếp cho KTV, không nhập chung vào giao dịch này.`,
          409,
        );
      }
      const referenceCode = group?.referenceCode ?? bookings[0].bookingCode;
      let payment = await tx.paymentTransaction.findUnique({ where: { idempotencyKey: `checkout:${referenceCode}` } });
      if (!payment) {
        payment = await tx.paymentTransaction.create({
          data: {
            bookingGroupId: groupId,
            bookingId: groupId ? undefined : bookings[0].id,
            branchId,
            customerId: group?.customerId ?? bookings[0].customerId,
            type: "SERVICE_PAYMENT",
            direction: "IN",
            status: "PENDING",
            amount: dueAmount,
            method: parsed.data.method,
            paymentCode: buildPaymentCode(referenceCode, "SERVICE_PAYMENT"),
            idempotencyKey: `checkout:${referenceCode}`,
            note: "Thanh toán chính xác phần còn lại của Bill tại quầy; không bao gồm Tip trực tiếp cho KTV.",
          },
        });
      }
      const confirmation = await confirmIncomingPayment(tx, payment.id, {
        actualAmount: parsed.data.actualAmount,
        externalReference: parsed.data.externalReference
          ? `counter:${parsed.data.externalReference}`
          : `counter:${randomUUID()}`,
        paidAt: new Date(),
        method: parsed.data.method,
      });
      if (!confirmation.idempotent) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: session.id,
            branchId,
            action: "CHECKOUT_PAYMENT_RECORD",
            entityType: "PaymentTransaction",
            entityId: payment.id,
            before: { status: payment.status, dueAmount },
            after: {
              status: confirmation.payment.status,
              actualAmount: parsed.data.actualAmount,
              method: parsed.data.method,
              tipAmount: 0,
              note: parsed.data.note,
            },
            ipHash: privateIdentifierDigest(requestIp(request)),
          },
        });
      }
      const platformFeeAmount = group?.depositAmount ?? bookings.reduce((sum, item) => sum + item.depositAmount, 0);
      return { confirmation, dueAmount, totalAmount, platformFeeAmount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      persisted: true,
      serviceRevenue: result.totalAmount,
      platformRevenue: result.platformFeeAmount,
      partnerRevenue: Math.max(0, result.totalAmount - result.platformFeeAmount),
      tipAmount: 0,
      paymentStatus: result.confirmation.payment.status,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutRecordError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof PaymentReconciliationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Mã tham chiếu đã được sử dụng cho giao dịch khác." }, { status: 409 });
    }
    console.error("payment.checkout_record_failed", error);
    return NextResponse.json({ error: "Không thể ghi nhận thanh toán tại quầy." }, { status: 503 });
  }
}
