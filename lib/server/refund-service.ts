import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { money, notifyCustomer, notifyOperations } from "@/lib/server/notification-service";

type RefundClient = Prisma.TransactionClient;
type RefundActor = {
  id: string;
  displayName: string;
  role: "OWNER" | "BRANCH_MANAGER" | "RECEPTIONIST" | "THERAPIST" | "INVESTOR" | "XGROUP_SUPER_ADMIN" | "DISTRICT_SALES_MANAGER";
  branchId: string | null;
};

const reservedStatuses = ["REQUESTED", "APPROVED", "COMPLETED"] as const;

export class RefundWorkflowError extends Error {
  constructor(
    readonly code:
      | "SOURCE_NOT_FOUND"
      | "SOURCE_NOT_ELIGIBLE"
      | "OUT_OF_SCOPE"
      | "AMOUNT_EXCEEDED"
      | "REQUEST_NOT_FOUND"
      | "INVALID_TRANSITION"
      | "FOUR_EYES_REQUIRED"
      | "DUPLICATE_REFERENCE",
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "RefundWorkflowError";
  }
}

function sourceReference(source: {
  paymentCode: string | null;
  bookingGroup: { referenceCode: string } | null;
  booking: { bookingCode: string } | null;
}) {
  return source.bookingGroup?.referenceCode ?? source.booking?.bookingCode ?? source.paymentCode ?? "giao dịch dịch vụ";
}

async function recalculateBookingPaymentState(
  tx: RefundClient,
  input: { bookingGroupId: string | null; bookingId: string | null },
) {
  if (input.bookingGroupId) {
    const group = await tx.bookingGroup.findUnique({
      where: { id: input.bookingGroupId },
      include: {
        bookings: { orderBy: { startTime: "asc" } },
        payments: {
          where: {
            direction: "IN",
            type: { in: ["DEPOSIT", "SERVICE_PAYMENT"] },
            status: { in: ["CONFIRMED", "REFUNDED"] },
          },
          select: { amount: true },
        },
        refundRequests: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
    });
    if (!group) return;
    const grossPaid = group.payments.reduce((sum, item) => sum + item.amount, 0);
    const refunded = group.refundRequests.reduce((sum, item) => sum + item.amount, 0);
    const netPaid = Math.max(0, Math.min(group.totalAmount, grossPaid - refunded));
    const groupPaymentStatus = grossPaid > 0 && refunded >= grossPaid
      ? "REFUNDED"
      : netPaid >= group.totalAmount
        ? "PAID"
        : netPaid > 0
          ? "DEPOSITED"
          : "UNPAID";
    await tx.bookingGroup.update({
      where: { id: group.id },
      data: { paidAmount: netPaid, paymentStatus: groupPaymentStatus },
    });
    let remaining = netPaid;
    for (const booking of group.bookings) {
      const paidAmount = Math.min(booking.totalAmount, remaining);
      remaining -= paidAmount;
      const paymentStatus = grossPaid > 0 && refunded >= grossPaid
        ? "REFUNDED"
        : paidAmount >= booking.totalAmount
          ? "PAID"
          : paidAmount > 0
            ? "DEPOSITED"
            : "UNPAID";
      await tx.booking.update({ where: { id: booking.id }, data: { paidAmount, paymentStatus } });
    }
    return;
  }

  if (input.bookingId) {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        payments: {
          where: {
            direction: "IN",
            type: { in: ["DEPOSIT", "SERVICE_PAYMENT"] },
            status: { in: ["CONFIRMED", "REFUNDED"] },
          },
          select: { amount: true },
        },
        refundRequests: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
    });
    if (!booking) return;
    const grossPaid = booking.payments.reduce((sum, item) => sum + item.amount, 0);
    const refunded = booking.refundRequests.reduce((sum, item) => sum + item.amount, 0);
    const netPaid = Math.max(0, Math.min(booking.totalAmount, grossPaid - refunded));
    const paymentStatus = grossPaid > 0 && refunded >= grossPaid
      ? "REFUNDED"
      : netPaid >= booking.totalAmount
        ? "PAID"
        : netPaid > 0
          ? "DEPOSITED"
          : "UNPAID";
    await tx.booking.update({ where: { id: booking.id }, data: { paidAmount: netPaid, paymentStatus } });
  }
}

export async function createRefundRequest(
  tx: RefundClient,
  input: { sourcePaymentId: string; amount: number; reason: string; ipHash: string },
  actor: RefundActor,
) {
  if (!(["OWNER", "BRANCH_MANAGER"] as string[]).includes(actor.role)) {
    throw new RefundWorkflowError("OUT_OF_SCOPE", "Chỉ Chủ và Quản lý cơ sở được lập yêu cầu hoàn tiền.", 403);
  }
  const source = await tx.paymentTransaction.findUnique({
    where: { id: input.sourcePaymentId },
    include: {
      bookingGroup: { select: { referenceCode: true, status: true } },
      booking: { select: { bookingCode: true, status: true } },
      customerPackage: { select: { id: true } },
      refundRequestsSource: {
        where: { status: { in: [...reservedStatuses] } },
        select: { amount: true },
      },
    },
  });
  if (!source) throw new RefundWorkflowError("SOURCE_NOT_FOUND", "Không tìm thấy giao dịch gốc.", 404);
  if (actor.role !== "OWNER" && source.branchId !== actor.branchId) {
    throw new RefundWorkflowError("OUT_OF_SCOPE", "Quản lý chỉ được lập hoàn tiền cho cơ sở mình phụ trách.", 403);
  }
  if (
    source.direction !== "IN"
    || source.status !== "CONFIRMED"
    || !(["DEPOSIT", "SERVICE_PAYMENT"] as string[]).includes(source.type)
    || source.amount <= 0
    || source.customerPackage
  ) {
    throw new RefundWorkflowError(
      "SOURCE_NOT_ELIGIBLE",
      "Chỉ hoàn từ khoản cọc hoặc tiền dịch vụ đã đối soát. Gói thành viên và Tip KTV cần quy trình xử lý riêng.",
    );
  }
  const reservedAmount = source.refundRequestsSource.reduce((sum, item) => sum + item.amount, 0);
  const refundableAmount = source.amount - reservedAmount;
  if (input.amount > refundableAmount) {
    throw new RefundWorkflowError(
      "AMOUNT_EXCEEDED",
      `Giao dịch chỉ còn ${money(Math.max(0, refundableAmount))} có thể hoàn. Tip khách trao trực tiếp cho KTV không thuộc giao dịch Bill và không nằm trong hạn mức hoàn.`,
    );
  }

  const requestId = randomUUID();
  const refundPayment = await tx.paymentTransaction.create({
    data: {
      bookingGroupId: source.bookingGroupId,
      bookingId: source.bookingId,
      branchId: source.branchId,
      customerId: source.customerId,
      type: "REFUND",
      direction: "OUT",
      status: "PENDING",
      amount: input.amount,
      method: "BANK_TRANSFER_MANUAL",
      idempotencyKey: `refund:${requestId}`,
      note: `Chờ duyệt hoàn tiền · ${input.reason}`,
    },
  });
  const refundRequest = await tx.refundRequest.create({
    data: {
      id: requestId,
      sourcePaymentId: source.id,
      refundPaymentId: refundPayment.id,
      bookingGroupId: source.bookingGroupId,
      bookingId: source.bookingId,
      branchId: source.branchId,
      customerId: source.customerId,
      amount: input.amount,
      reason: input.reason,
      requestedByUserId: actor.id,
    },
  });
  const reference = sourceReference(source);
  await tx.adminAuditLog.create({
    data: {
      actorUserId: actor.id,
      branchId: source.branchId,
      action: "REFUND_REQUEST_CREATE",
      entityType: "RefundRequest",
      entityId: requestId,
      after: {
        sourcePaymentId: source.id,
        refundPaymentId: refundPayment.id,
        reference,
        amount: input.amount,
        reason: input.reason,
        refundableBeforeRequest: refundableAmount,
      },
      ipHash: input.ipHash,
    },
  });
  await notifyOperations(tx, {
    branchId: source.branchId,
    audience: "MANAGEMENT",
    type: "FINANCE",
    title: "Yêu cầu hoàn tiền chờ Chủ duyệt",
    body: `${reference} · ${money(input.amount)} · lập bởi ${actor.displayName}.`,
    actionUrl: "/admin/refunds",
  });
  return refundRequest;
}

export async function transitionRefundRequest(
  tx: RefundClient,
  input: {
    requestId: string;
    action: "APPROVE" | "REJECT" | "COMPLETE" | "CANCEL";
    note?: string;
    bankReference?: string;
    ipHash: string;
  },
  actor: RefundActor,
) {
  if (!(["OWNER", "BRANCH_MANAGER"] as string[]).includes(actor.role)) {
    throw new RefundWorkflowError("OUT_OF_SCOPE", "Bạn không có quyền xử lý hoàn tiền.", 403);
  }
  const request = await tx.refundRequest.findUnique({
    where: { id: input.requestId },
    include: {
      sourcePayment: {
        include: {
          bookingGroup: { select: { referenceCode: true, status: true } },
          booking: { select: { bookingCode: true, status: true } },
        },
      },
      refundPayment: true,
      customer: { select: { totalSpend: true } },
    },
  });
  if (!request) throw new RefundWorkflowError("REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu hoàn tiền.", 404);
  if (actor.role !== "OWNER" && request.branchId !== actor.branchId) {
    throw new RefundWorkflowError("OUT_OF_SCOPE", "Bạn không có quyền xử lý yêu cầu ngoài cơ sở phụ trách.", 403);
  }
  const reference = sourceReference(request.sourcePayment);
  const now = new Date();

  if (input.action === "CANCEL") {
    if (request.status !== "REQUESTED" || (actor.role !== "OWNER" && request.requestedByUserId !== actor.id)) {
      throw new RefundWorkflowError("INVALID_TRANSITION", "Chỉ người lập hoặc Chủ hệ thống được hủy yêu cầu đang chờ duyệt.");
    }
    await tx.refundRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", approvalNote: input.note } });
    if (request.refundPaymentId) await tx.paymentTransaction.update({ where: { id: request.refundPaymentId }, data: { status: "VOID", note: `Đã hủy yêu cầu · ${input.note ?? request.reason}` } });
  } else {
    if (actor.role !== "OWNER") {
      throw new RefundWorkflowError("OUT_OF_SCOPE", "Chỉ Chủ Tâm An được duyệt, từ chối hoặc xác nhận đã chuyển hoàn tiền.", 403);
    }
    if (input.action === "APPROVE") {
      if (request.status !== "REQUESTED") throw new RefundWorkflowError("INVALID_TRANSITION", "Yêu cầu không còn ở trạng thái chờ duyệt.");
      if (request.requestedByUserId === actor.id) {
        throw new RefundWorkflowError("FOUR_EYES_REQUIRED", "Người lập không được tự duyệt. Cần một tài khoản Chủ khác kiểm tra độc lập.");
      }
      await tx.refundRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", approvedByUserId: actor.id, approvedAt: now, approvalNote: input.note },
      });
      if (request.customerId) {
        await notifyCustomer(tx, request.customerId, {
          branchId: request.branchId,
          type: "PAYMENT",
          title: "Khoản hoàn tiền đã được phê duyệt",
          body: `${reference} · ${money(request.amount)} đang chờ cơ sở thực hiện chuyển khoản.`,
          actionUrl: "/vi",
        });
      }
    }
    if (input.action === "REJECT") {
      if (request.status !== "REQUESTED") throw new RefundWorkflowError("INVALID_TRANSITION", "Chỉ từ chối yêu cầu đang chờ duyệt.");
      await tx.refundRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", approvedByUserId: actor.id, rejectedAt: now, approvalNote: input.note },
      });
      if (request.refundPaymentId) await tx.paymentTransaction.update({ where: { id: request.refundPaymentId }, data: { status: "VOID", note: `Từ chối hoàn tiền · ${input.note ?? request.reason}` } });
    }
    if (input.action === "COMPLETE") {
      if (request.status !== "APPROVED" || !request.refundPaymentId) {
        throw new RefundWorkflowError("INVALID_TRANSITION", "Khoản hoàn phải được một Chủ khác phê duyệt trước khi ghi nhận đã chuyển.");
      }
      if (!input.bankReference) throw new RefundWorkflowError("DUPLICATE_REFERENCE", "Cần nhập mã giao dịch ngân hàng đã hoàn.", 400);
      const externalReference = `refund:${input.bankReference.trim()}`;
      const duplicate = await tx.paymentTransaction.findFirst({
        where: { externalReference, id: { not: request.refundPaymentId } },
        select: { id: true },
      });
      if (duplicate) throw new RefundWorkflowError("DUPLICATE_REFERENCE", "Mã giao dịch ngân hàng đã được dùng.");
      await tx.paymentTransaction.update({
        where: { id: request.refundPaymentId },
        data: {
          status: "CONFIRMED",
          paidAt: now,
          externalReference,
          receivedAmount: request.amount,
          note: `Đã chuyển hoàn tiền · ${request.reason}`,
        },
      });
      await tx.refundRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          completedByUserId: actor.id,
          completedAt: now,
          bankReference: input.bankReference.trim(),
          approvalNote: input.note ?? request.approvalNote,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          branchId: request.branchId,
          customerId: request.customerId,
          bookingGroupId: request.bookingGroupId,
          bookingId: request.bookingId,
          paymentTransactionId: request.refundPaymentId,
          category: "REFUND",
          direction: "OUT",
          amount: request.amount,
          description: `Hoàn tiền ${reference} · ${request.reason}`,
          occurredAt: now,
        },
      });
      const completedForSource = await tx.refundRequest.aggregate({
        where: { sourcePaymentId: request.sourcePaymentId, status: "COMPLETED" },
        _sum: { amount: true },
      });
      if ((completedForSource._sum.amount ?? 0) >= request.sourcePayment.amount) {
        await tx.paymentTransaction.update({ where: { id: request.sourcePaymentId }, data: { status: "REFUNDED" } });
      }
      await recalculateBookingPaymentState(tx, {
        bookingGroupId: request.bookingGroupId,
        bookingId: request.bookingId,
      });
      const relatedServiceCompleted = request.sourcePayment.bookingGroup?.status === "COMPLETED"
        || request.sourcePayment.booking?.status === "COMPLETED";
      if (relatedServiceCompleted && request.customerId && request.customer) {
        await tx.customer.update({
          where: { id: request.customerId },
          data: { totalSpend: Math.max(0, request.customer.totalSpend - request.amount) },
        });
      }
      if (request.customerId) {
        await notifyCustomer(tx, request.customerId, {
          branchId: request.branchId,
          type: "PAYMENT",
          title: "Đã chuyển hoàn tiền",
          body: `${reference} · ${money(request.amount)} · mã ngân hàng ${input.bankReference.trim()}.`,
          actionUrl: "/vi",
        });
      }
    }
  }

  await tx.adminAuditLog.create({
    data: {
      actorUserId: actor.id,
      branchId: request.branchId,
      action: `REFUND_${input.action}`,
      entityType: "RefundRequest",
      entityId: request.id,
      before: { status: request.status },
      after: {
        amount: request.amount,
        reference,
        note: input.note ?? null,
        bankReference: input.action === "COMPLETE" ? input.bankReference : null,
      },
      ipHash: input.ipHash,
    },
  });
  await notifyOperations(tx, {
    branchId: request.branchId,
    audience: "MANAGEMENT",
    type: "FINANCE",
    title: input.action === "APPROVE"
      ? "Đã duyệt yêu cầu hoàn tiền"
      : input.action === "COMPLETE"
        ? "Đã chuyển hoàn tiền"
        : input.action === "REJECT"
          ? "Đã từ chối yêu cầu hoàn tiền"
          : "Đã hủy yêu cầu hoàn tiền",
    body: `${reference} · ${money(request.amount)} · ${actor.displayName}.`,
    actionUrl: "/admin/refunds",
  });

  return tx.refundRequest.findUnique({ where: { id: request.id } });
}
