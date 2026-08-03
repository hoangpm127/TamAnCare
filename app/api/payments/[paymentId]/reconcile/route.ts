import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { confirmIncomingPayment, PaymentReconciliationError } from "@/lib/server/payment-service";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  requestIp,
} from "@/lib/server/request-security";

const reconcileSchema = z.object({
  actualAmount: z.coerce.number().int().positive(),
  method: z.enum(["CASH", "CARD_POS", "BANK_TRANSFER_MANUAL"]),
  externalReference: z.string().trim().min(4).max(120).optional(),
  bankCode: z.string().trim().max(40).optional(),
  note: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được đối soát thủ công." }, { status: 401 });
  const parsed = reconcileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin đối soát chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const rateLimit = await consumeRateLimit({
    scope: "payment-manual-reconcile",
    identifier: session.id,
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Đã thao tác quá nhiều lần. Vui lòng kiểm tra lại trước khi tiếp tục." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { paymentId } = await context.params;
  const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ error: "Không tìm thấy yêu cầu thanh toán." }, { status: 404 });
  if (session.role !== "OWNER" && payment.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn không có quyền đối soát giao dịch ngoài cơ sở phụ trách." }, { status: 403 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const confirmation = await confirmIncomingPayment(tx, payment.id, {
        actualAmount: parsed.data.actualAmount,
        externalReference: parsed.data.externalReference
          ? `manual:${parsed.data.externalReference}`
          : `manual:${randomUUID()}`,
        paidAt: new Date(),
        method: parsed.data.method,
        bankCode: parsed.data.bankCode,
      });
      if (!confirmation.idempotent) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: session.id,
            branchId: payment.branchId,
            action: "PAYMENT_MANUAL_RECONCILE",
            entityType: "PaymentTransaction",
            entityId: payment.id,
            before: {
              status: payment.status,
              expectedAmount: payment.amount,
            },
            after: {
              status: confirmation.payment.status,
              receivedAmount: parsed.data.actualAmount,
              method: parsed.data.method,
              note: parsed.data.note,
              tipAmount: confirmation.tipAmount,
            },
            ipHash: privateIdentifierDigest(requestIp(request)),
          },
        });
      }
      return confirmation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      reconciled: true,
      idempotent: result.idempotent,
      paymentStatus: result.payment.status,
      receivedAmount: result.payment.receivedAmount,
      tipAmount: result.tipAmount,
    });
  } catch (error) {
    if (error instanceof PaymentReconciliationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Mã đối soát đã được sử dụng cho giao dịch khác." }, { status: 409 });
    }
    console.error("payment.manual_reconcile_failed", error);
    return NextResponse.json({ error: "Không thể đối soát giao dịch." }, { status: 503 });
  }
}
