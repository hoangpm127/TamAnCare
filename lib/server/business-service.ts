import "server-only";

import { addMinutes } from "date-fns";
import type { Prisma } from "@/app/generated/prisma/client";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { markBusinessLeadStage } from "@/lib/server/xgroup-attribution";

type BusinessClient = Prisma.TransactionClient;

export class BusinessFlowError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "BusinessFlowError";
  }
}

export async function startBusinessService(tx: BusinessClient, eventCode: string, now = new Date()) {
  const event = await tx.officeEvent.findUnique({ where: { eventCode }, include: { leadTherapist: true } });
  if (!event) throw new BusinessFlowError("Không tìm thấy hồ sơ Tâm An Business.", 404);
  if (!event.leadTherapist) throw new BusinessFlowError("Cơ sở chưa phân công KTV Business trưởng.");
  if (event.status === "IN_SERVICE") return event;
  if (!["DEPOSIT_CONFIRMED", "READY"].includes(event.status)) {
    throw new BusinessFlowError("Đơn Business chưa đủ điều kiện bắt đầu phục vụ.");
  }
  if (event.depositAmount > 0 && event.paidAmount < event.depositAmount) {
    throw new BusinessFlowError("Khoản cọc chưa được ngân hàng đối soát.");
  }
  const plannedMinutes = Math.max(15, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000));
  const updated = await tx.officeEvent.update({
    where: { id: event.id },
    data: { status: "IN_SERVICE", actualStartedAt: now, expectedEndAt: addMinutes(now, plannedMinutes), actualEndedAt: null, endReminderSentAt: null },
    include: { leadTherapist: true },
  });
  await tx.officeRegistration.updateMany({ where: { eventId: event.id, status: "REGISTERED" }, data: { status: "CHECKED_IN" } });
  await markBusinessLeadStage(tx, event.id, "IN_SERVICE");
  if (event.customerId) {
    await notifyCustomer(tx, event.customerId, {
      branchId: event.branchId,
      type: "BOOKING",
      title: "Tâm An Business đã bắt đầu",
      body: `${event.companyName} · KTV trưởng ${event.leadTherapist.fullName} · dự kiến kết thúc lúc ${updated.expectedEndAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}.`,
      actionUrl: `/doanh-nghiep/${event.eventCode}`,
    });
  }
  await notifyTherapist(tx, {
    therapistName: event.leadTherapist.fullName,
    branchId: event.branchId,
    type: "BOOKING",
    title: `Đã bắt đầu Business · ${event.companyName}`,
    body: `Đồng hồ phục vụ đã chạy tại ${event.location}.`,
    actionUrl: `/therapist/business/${event.eventCode}`,
  });
  await notifyOperations(tx, {
    branchId: event.branchId,
    type: "BOOKING",
    title: `Business đang phục vụ · ${event.companyName}`,
    body: `${event.leadTherapist.fullName} phụ trách · ${event.location} · đồng hồ đã bắt đầu.`,
    actionUrl: `/admin/business/${event.eventCode}`,
  });
  return updated;
}

export async function sendBusinessEndReminder(tx: BusinessClient, eventCode: string, now = new Date()) {
  const event = await tx.officeEvent.findUnique({ where: { eventCode }, include: { leadTherapist: true } });
  if (!event) throw new BusinessFlowError("Không tìm thấy hồ sơ Tâm An Business.", 404);
  if (event.status !== "IN_SERVICE") return event;
  if (event.endReminderSentAt) return event;
  const updated = await tx.officeEvent.update({ where: { id: event.id }, data: { endReminderSentAt: now } });
  const title = `Đã đến giờ kết thúc · ${event.companyName}`;
  if (event.customerId) {
    await notifyCustomer(tx, event.customerId, {
      branchId: event.branchId,
      type: "REMINDER",
      title,
      body: "Vui lòng quét lại QR trên điện thoại KTV Business trưởng để chốt thời gian và thanh toán phần còn lại.",
      actionUrl: `/doanh-nghiep/${event.eventCode}`,
    });
  }
  await notifyTherapist(tx, {
    therapistName: event.leadTherapist?.fullName,
    branchId: event.branchId,
    type: "REMINDER",
    title,
    body: "Mời người đặt dịch vụ quét lại QR để kết thúc phiên phục vụ.",
    actionUrl: `/therapist/business/${event.eventCode}`,
  });
  await notifyOperations(tx, {
    branchId: event.branchId,
    type: "REMINDER",
    title,
    body: `${event.location} · đang chờ khách xác nhận kết thúc và thanh toán công nợ.`,
    actionUrl: `/admin/business/${event.eventCode}`,
  });
  return updated;
}

export async function endBusinessService(tx: BusinessClient, eventCode: string, bankCode: string | undefined, guestSessionId: string | undefined, now = new Date()) {
  const event = await tx.officeEvent.findUnique({ where: { eventCode }, include: { leadTherapist: true } });
  if (!event) throw new BusinessFlowError("Không tìm thấy hồ sơ Tâm An Business.", 404);
  if (event.status === "AWAITING_BALANCE" || event.status === "COMPLETED") {
    const payment = await tx.paymentTransaction.findUnique({ where: { idempotencyKey: `business-balance:${event.eventCode}` } });
    return { event, payment, dueAmount: Math.max(0, event.totalAmount - Math.min(event.paidAmount, event.totalAmount)) };
  }
  if (event.status !== "IN_SERVICE") throw new BusinessFlowError("Phiên Business chưa bắt đầu hoặc đã được kết thúc.");
  const dueAmount = Math.max(0, event.totalAmount - Math.min(event.paidAmount, event.totalAmount));
  let payment = null;
  if (dueAmount > 0) {
    payment = await tx.paymentTransaction.upsert({
      where: { idempotencyKey: `business-balance:${event.eventCode}` },
      create: {
        officeEventId: event.id,
        branchId: event.branchId,
        customerId: event.customerId,
        type: "SERVICE_PAYMENT",
        direction: "IN",
        status: "PENDING",
        amount: dueAmount,
        method: "BANK_TRANSFER_SEPAY",
        bankCode,
        paymentCode: buildPaymentCode(event.eventCode, "SERVICE_PAYMENT"),
        idempotencyKey: `business-balance:${event.eventCode}`,
        note: "Thanh toán chính xác phần còn lại Tâm An Business; Tip tùy tâm trao trực tiếp cho KTV và không chuyển chung với Bill.",
      },
      update: { bankCode: bankCode ?? undefined },
    });
    if (guestSessionId) {
      await tx.paymentAccessGrant.upsert({
        where: { guestSessionId_paymentTransactionId: { guestSessionId, paymentTransactionId: payment.id } },
        create: { guestSessionId, paymentTransactionId: payment.id, expiresAt: addMinutes(now, 180 * 24 * 60) },
        update: { expiresAt: addMinutes(now, 180 * 24 * 60) },
      });
    }
  }
  const updated = await tx.officeEvent.update({
    where: { id: event.id },
    data: dueAmount === 0
      ? { status: "COMPLETED", paymentStatus: "PAID", actualEndedAt: now, completedAt: now, sessionsUsed: Math.min(event.sessionsTotal, event.sessionsUsed + 1) }
      : { status: "AWAITING_BALANCE", actualEndedAt: now },
  });
  if (dueAmount === 0) await markBusinessLeadStage(tx, event.id, "WON");
  if (event.customerId) {
    await notifyCustomer(tx, event.customerId, {
      branchId: event.branchId,
      type: dueAmount > 0 ? "PAYMENT" : "SYSTEM",
      title: dueAmount > 0 ? "Đã chốt giờ · mời thanh toán Business" : "Tâm An Business đã hoàn tất",
      body: dueAmount > 0 ? `Còn lại ${money(dueAmount)}. VietQR đã điền sẵn số tiền và nội dung đối soát.` : "Phiên phục vụ đã hoàn tất và Bill đã thanh toán đủ.",
      actionUrl: `/doanh-nghiep/${event.eventCode}`,
    });
  }
  await notifyOperations(tx, {
    branchId: event.branchId,
    type: dueAmount > 0 ? "FINANCE" : "SYSTEM",
    title: `Đã chốt giờ Business · ${event.companyName}`,
    body: dueAmount > 0 ? `Công nợ còn lại ${money(dueAmount)} đang chờ ngân hàng đối soát.` : "Bill đã đủ và phiên phục vụ đã hoàn tất.",
    actionUrl: `/admin/business/${event.eventCode}`,
  });
  return { event: updated, payment, dueAmount };
}

export async function saveBusinessReview(tx: BusinessClient, eventCode: string, rating: number, comment?: string) {
  const event = await tx.officeEvent.findUnique({ where: { eventCode }, include: { leadTherapist: true } });
  if (!event) throw new BusinessFlowError("Không tìm thấy hồ sơ Tâm An Business.", 404);
  if (event.status !== "COMPLETED") throw new BusinessFlowError("Chỉ có thể đánh giá sau khi dịch vụ và thanh toán đã hoàn tất.");
  const updated = await tx.officeEvent.update({ where: { id: event.id }, data: { customerRating: rating, customerComment: comment, reviewedAt: new Date() } });
  await notifyOperations(tx, {
    branchId: event.branchId,
    type: rating <= 3 ? "REMINDER" : "SYSTEM",
    title: `${rating <= 3 ? "Cần chăm sóc lại" : "Đánh giá Business mới"} · ${event.companyName}`,
    body: `${rating}/5 sao${comment ? ` · ${comment}` : ""}.`,
    actionUrl: `/admin/business/${event.eventCode}`,
  });
  return updated;
}
