import "server-only";

import { createHash } from "node:crypto";
import type { Prisma, TransactionType } from "@/app/generated/prisma/client";
import { maybeAutoConfirmBookingGroup, type BookingAutomationResult } from "@/lib/server/booking-automation";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { markBusinessLeadStage } from "@/lib/server/xgroup-attribution";
import { affiliateCommissionAmount, affiliateCustomerId, affiliateOwnerEligible, AFFILIATE_RECONCILIATION_DAYS } from "@/lib/referral-policy";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

type PaymentClient = Prisma.TransactionClient;

export class PaymentReconciliationError extends Error {
  constructor(
    readonly code: "PAYMENT_NOT_FOUND" | "PAYMENT_NOT_PENDING" | "PAYMENT_EXPIRED" | "AMOUNT_MISMATCH" | "UNSUPPORTED_PAYMENT",
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "PaymentReconciliationError";
  }
}

export function normalizeTransferCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildPaymentCode(referenceCode: string, type: Extract<TransactionType, "DEPOSIT" | "SERVICE_PAYMENT">) {
  const compact = normalizeTransferCode(referenceCode).slice(-18);
  const checksum = createHash("sha256").update(`${type}:${referenceCode}`).digest("hex").slice(0, 6).toUpperCase();
  return `${type === "DEPOSIT" ? "TACD" : "TACS"}${compact}${checksum}`;
}

export type IncomingPaymentConfirmation = {
  actualAmount: number;
  externalReference: string;
  paidAt: Date;
  method: string;
  bankCode?: string;
};

export async function confirmIncomingPayment(
  tx: PaymentClient,
  paymentId: string,
  confirmation: IncomingPaymentConfirmation,
) {
  const payment = await tx.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: {
      bookingGroup: {
        include: {
          customer: true,
          bookings: { include: { service: true, therapist: true }, orderBy: { startTime: "asc" } },
        },
      },
      booking: { include: { customer: true, service: true, therapist: true } },
      officeEvent: { include: { customer: true, leadTherapist: true } },
      customerPackage: { include: { packagePlan: true, campaign: true } },
    },
  });
  if (!payment) throw new PaymentReconciliationError("PAYMENT_NOT_FOUND", "Không tìm thấy yêu cầu thanh toán.", 404);
  if (payment.status === "CONFIRMED") {
    return { payment, tipAmount: 0, idempotent: true };
  }
  if (payment.status !== "PENDING") {
    throw new PaymentReconciliationError("PAYMENT_NOT_PENDING", "Giao dịch không còn ở trạng thái chờ đối soát.");
  }
  if (
    payment.type === "DEPOSIT"
    && payment.bookingGroup?.holdExpiresAt
    && confirmation.paidAt > payment.bookingGroup.holdExpiresAt
  ) {
    throw new PaymentReconciliationError(
      "PAYMENT_EXPIRED",
      "Khoản tiền được chuyển sau khi thời gian giữ chỗ đã hết; cần hoàn tiền hoặc xử lý thủ công.",
    );
  }
  if (!Number.isSafeInteger(confirmation.actualAmount) || confirmation.actualAmount <= 0) {
    throw new PaymentReconciliationError("AMOUNT_MISMATCH", "Số tiền thực nhận không hợp lệ.", 400);
  }
  if (payment.type === "DEPOSIT" && confirmation.actualAmount !== payment.amount) {
    throw new PaymentReconciliationError(
      "AMOUNT_MISMATCH",
      `Khoản cọc cần đúng ${money(payment.amount)}; ngân hàng ghi nhận ${money(confirmation.actualAmount)}.`,
    );
  }
  if (payment.type === "SERVICE_PAYMENT" && confirmation.actualAmount !== payment.amount) {
    throw new PaymentReconciliationError(
      "AMOUNT_MISMATCH",
      `Bill cần thanh toán đúng ${money(payment.amount)}; ngân hàng ghi nhận ${money(confirmation.actualAmount)}. Tip tùy tâm được trao trực tiếp cho KTV, không chuyển chung với Bill.`,
    );
  }
  if (!(["DEPOSIT", "SERVICE_PAYMENT"] as TransactionType[]).includes(payment.type)) {
    throw new PaymentReconciliationError("UNSUPPORTED_PAYMENT", "Loại giao dịch này cần được kế toán xử lý riêng.");
  }

  const group = payment.bookingGroup;
  const directBooking = payment.booking;
  const businessEvent = payment.officeEvent;
  const bookings = group?.bookings ?? (directBooking ? [directBooking] : []);
  const customerId = payment.customerId ?? group?.customerId ?? directBooking?.customerId ?? businessEvent?.customerId;
  const customerName = group?.customer.fullName ?? directBooking?.customer.fullName ?? businessEvent?.customer?.fullName ?? "Khách Tâm An";
  const standaloneBusinessReference = payment.idempotencyKey.startsWith("business-deposit:")
    ? payment.idempotencyKey.slice("business-deposit:".length)
    : null;
  const referenceCode = group?.referenceCode ?? directBooking?.bookingCode ?? businessEvent?.eventCode ?? standaloneBusinessReference ?? payment.paymentCode ?? payment.id;
  const tipAmount = 0;
  let bookingAutomation: BookingAutomationResult | null = null;
  const reservedVoucherUsages = payment.type === "DEPOSIT" && group
    ? await tx.voucherUsage.findMany({
        where: { booking: { groupId: group.id }, status: "RESERVED" },
        include: { voucher: true },
      })
    : [];
  const reservedWelcomeUsage = reservedVoucherUsages.find((usage) => usage.voucher.code === "WELCOME150");
  const reservedWelcomeDiscount = reservedWelcomeUsage
    ? reservedWelcomeUsage.discountAmount || (reservedVoucherUsages.length === 1 ? group?.discountAmount ?? 0 : 0)
    : 0;
  if (group && reservedWelcomeUsage && reservedWelcomeDiscount > 0) {
    const account = await tx.customerAccount.findUnique({ where: { customerId: group.customerId } });
    if (!account || account.creditBalance < reservedWelcomeDiscount) {
      throw new PaymentReconciliationError(
        "PAYMENT_NOT_PENDING",
        "Quyền lợi WELCOME150 không còn đủ để xác nhận booking; cần nhân viên kiểm tra.",
      );
    }
  }

  const updatedPayment = await tx.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: "CONFIRMED",
      receivedAmount: confirmation.actualAmount,
      externalReference: confirmation.externalReference,
      method: confirmation.method,
      bankCode: confirmation.bankCode ?? payment.bankCode,
      paidAt: confirmation.paidAt,
    },
  });

  if (payment.type === "DEPOSIT") {
    const existingLedger = await tx.ledgerEntry.findFirst({
      where: { paymentTransactionId: payment.id, category: "CUSTOMER_DEPOSIT" },
      select: { id: true },
    });
    if (!existingLedger) {
      await tx.ledgerEntry.create({
        data: {
          branchId: payment.branchId,
          customerId,
          bookingGroupId: group?.id,
          bookingId: directBooking?.id,
          officeEventId: businessEvent?.id,
          paymentTransactionId: payment.id,
          category: "CUSTOMER_DEPOSIT",
          direction: "IN",
          amount: payment.amount,
          description: `Tiền cọc giữ chỗ ${referenceCode}`,
          occurredAt: confirmation.paidAt,
        },
      });
    }
    if (group) {
      await tx.bookingGroup.update({
        where: { id: group.id },
        data: {
          paidAmount: payment.amount,
          paymentStatus: payment.amount >= group.totalAmount ? "PAID" : "DEPOSITED",
          holdExpiresAt: null,
        },
      });
      for (const booking of bookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            paidAmount: booking.depositAmount,
            paymentStatus: booking.depositAmount >= booking.totalAmount ? "PAID" : "DEPOSITED",
          },
        });
      }

      for (const usage of reservedVoucherUsages) {
        await tx.voucherUsage.update({
          where: { id: usage.id },
          data: { status: "CONFIRMED", confirmedAt: confirmation.paidAt, expiresAt: null },
        });
        if (usage.voucher.code === "WELCOME150" && reservedWelcomeDiscount > 0) {
          await tx.customerAccount.update({
            where: { customerId: group.customerId },
            data: { creditBalance: { decrement: reservedWelcomeDiscount } },
          });
          const welcomeCreditLedger = await tx.ledgerEntry.findFirst({
            where: { bookingGroupId: group.id, category: "WELCOME_CREDIT" },
            select: { id: true },
          });
          if (!welcomeCreditLedger) {
            await tx.ledgerEntry.create({
              data: {
                branchId: payment.branchId,
                customerId: group.customerId,
                bookingGroupId: group.id,
                bookingId: bookings[0]?.id,
                paymentTransactionId: payment.id,
                category: "WELCOME_CREDIT",
                direction: "OUT",
                amount: reservedWelcomeDiscount,
                description: `Quyền lợi thành viên mới WELCOME150 · ${referenceCode}`,
                occurredAt: confirmation.paidAt,
              },
            });
          }
        }
        if (usage.voucher.code === "AFF50" && usage.discountAmount > 0) {
          const affiliateVoucherLedger = await tx.ledgerEntry.findFirst({
            where: { bookingGroupId: group.id, category: "ADJUSTMENT", description: { startsWith: "Voucher cài app Affiliate AFF50" } },
            select: { id: true },
          });
          if (!affiliateVoucherLedger) {
            await tx.ledgerEntry.create({
              data: {
                branchId: payment.branchId,
                customerId: group.customerId,
                bookingGroupId: group.id,
                bookingId: bookings[0]?.id,
                paymentTransactionId: payment.id,
                category: "ADJUSTMENT",
                direction: "OUT",
                amount: usage.discountAmount,
                description: `Voucher cài app Affiliate AFF50 · ${referenceCode}`,
                occurredAt: confirmation.paidAt,
              },
            });
          }
        }
      }
      bookingAutomation = await maybeAutoConfirmBookingGroup(tx, group.id);
    } else if (directBooking) {
      await tx.booking.update({
        where: { id: directBooking.id },
        data: {
          paidAmount: payment.amount,
          paymentStatus: payment.amount >= directBooking.totalAmount ? "PAID" : "DEPOSITED",
        },
      });
    }
    if (businessEvent) {
      await tx.officeEvent.update({
        where: { id: businessEvent.id },
        data: {
          paidAmount: payment.amount,
          paymentStatus: payment.amount >= businessEvent.totalAmount ? "PAID" : "DEPOSITED",
          status: businessEvent.leadTherapistId ? "READY" : "DEPOSIT_CONFIRMED",
        },
      });
      await markBusinessLeadStage(tx, businessEvent.id, "SCHEDULED");
    }

    if (customerId) {
      await notifyCustomer(tx, customerId, {
        branchId: payment.branchId,
        type: bookingAutomation?.confirmed ? "BOOKING" : "PAYMENT",
        title: standaloneBusinessReference
          ? "Đã đối soát cọc Tâm An Business"
          : bookingAutomation?.confirmed
            ? "Chúc mừng! Lịch đã được AI xác nhận"
            : bookingAutomation?.enabled && bookingAutomation.reason === "NO_RESOURCE"
              ? "Đã đối soát cọc · IQ Care đang xếp lịch"
              : "Đã đối soát khoản cọc",
        body: standaloneBusinessReference
          ? `${referenceCode} đã nhận đúng ${money(payment.amount)}. Đội ngũ sẽ liên hệ để chốt phương án triển khai.`
          : bookingAutomation?.confirmed
            ? `${referenceCode} đã được xếp ${bookingAutomation.assignments.map((item) => `${item.therapistName} · ${item.roomName}`).join(", ")}. Mở Đơn của tôi và dùng Camera quét QR tại cơ sở để check-in.`
            : bookingAutomation?.enabled && bookingAutomation.reason === "NO_RESOURCE"
              ? `${referenceCode} đã nhận đúng ${money(payment.amount)}. IQ Care đang tự tìm tổ hợp KTV và giường phù hợp, không xếp chồng lịch.`
              : `${referenceCode} đã nhận đúng ${money(payment.amount)}. Lịch đang ở chế độ xác nhận thủ công của cơ sở.`,
        actionUrl: businessEvent ? `/doanh-nghiep/${referenceCode}` : standaloneBusinessReference ? "/thong-bao" : `/booking/success/${referenceCode}`,
      });
    }
    await notifyOperations(tx, {
      branchId: payment.branchId,
      type: bookingAutomation?.confirmed ? "BOOKING" : "FINANCE",
      title: standaloneBusinessReference
        ? `Đã nhận cọc Business · ${customerName}`
        : bookingAutomation?.confirmed
          ? `AI đã xác nhận & điều phối · ${customerName}`
          : bookingAutomation?.enabled && bookingAutomation.reason === "NO_RESOURCE"
            ? `IQ Care cần xếp thêm tài nguyên · ${customerName}`
            : `Đã nhận cọc · ${customerName}`,
      body: bookingAutomation?.confirmed
        ? `${referenceCode} · ${money(payment.amount)} đã đối soát; lịch đã được xác nhận và phân công ${bookingAutomation.assignments.map((item) => `${item.therapistName} tại ${item.roomName}`).join(", ")}. Không cần duyệt lại.`
        : bookingAutomation?.enabled && bookingAutomation.reason === "NO_RESOURCE"
          ? `${referenceCode} · ${money(payment.amount)} đã đối soát; chưa tìm thấy tổ hợp KTV và giường còn trống. Hệ thống không xếp chồng lịch và sẽ tiếp tục tự thử lại.`
          : `${referenceCode} · ${money(payment.amount)} đã được ngân hàng đối soát; vui lòng xác nhận ${standaloneBusinessReference ? "kế hoạch triển khai" : "lịch"}.`,
      actionUrl: businessEvent ? `/admin/business/${referenceCode}` : standaloneBusinessReference ? "/admin/office-events" : "/admin/bookings",
    });
    if (bookingAutomation?.confirmed) {
      for (const assignment of bookingAutomation.assignments) {
        await notifyTherapist(tx, {
          branchId: payment.branchId,
          therapistName: assignment.therapistName,
          type: "BOOKING",
          title: `IQ Care vừa điều phối lịch mới · ${customerName}`,
          body: `${assignment.serviceName} · ${referenceCode} · ${assignment.roomName}. Khoản cọc đã đối soát; lịch đã sẵn sàng trong Lịch của tôi.`,
          actionUrl: `/therapist/bookings/${assignment.bookingCode}`,
        });
      }
    }
  }

  if (payment.type === "SERVICE_PAYMENT" && payment.customerPackage) {
    const customerPackage = payment.customerPackage;
    const expiry = new Date(confirmation.paidAt.getTime() + customerPackage.packagePlan.validityDays * 24 * 60 * 60 * 1000);
    await tx.customerPackage.update({
      where: { id: customerPackage.id },
      data: { status: "ACTIVE", expiresAt: expiry },
    });
    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { totalSpend: { increment: payment.amount } },
      });
    }
    const revenue = await tx.ledgerEntry.findFirst({
      where: { paymentTransactionId: payment.id, category: "SERVICE_REVENUE" },
      select: { id: true },
    });
    if (!revenue) {
      await tx.ledgerEntry.create({
        data: {
          branchId: payment.branchId,
          customerId,
          paymentTransactionId: payment.id,
          category: "SERVICE_REVENUE",
          direction: "IN",
          amount: payment.amount,
          description: `Gói thành viên · ${customerPackage.packagePlan.name}`,
          occurredAt: confirmation.paidAt,
        },
      });
    }
    const affiliateCampaign = customerPackage.campaign;
    if (affiliateCampaign?.source.startsWith("AFFILIATE:") && payment.amount > 0) {
      const affiliateOwnerCustomerId = affiliateCustomerId(affiliateCampaign.source);
      if (affiliateOwnerCustomerId && affiliateOwnerCustomerId !== customerId) {
        const affiliate = await tx.customer.findUnique({
          where: { id: affiliateOwnerCustomerId },
          include: { account: { select: { phoneVerifiedAt: true } } },
        });
        const commissionExists = await tx.ledgerEntry.findFirst({
          where: { paymentTransactionId: payment.id, category: "OPERATING_EXPENSE", description: { startsWith: "Hoa hồng Affiliate" } },
          select: { id: true },
        });
        if (affiliate && !commissionExists && affiliateOwnerEligible(affiliate.account, phoneVerificationRequired())) {
          const commissionAmount = affiliateCommissionAmount(payment.amount);
          const expense = await tx.expense.create({
            data: {
              branchId: payment.branchId,
              category: "MARKETING",
              description: `Hoa hồng Affiliate gói · ${affiliateCampaign.code} · ${customerPackage.packagePlan.name}`,
              amount: commissionAmount,
              vendor: affiliate.fullName,
              occurredAt: confirmation.paidAt,
            },
          });
          await tx.ledgerEntry.create({
            data: {
              branchId: payment.branchId,
              customerId: affiliate.id,
              paymentTransactionId: payment.id,
              expenseId: expense.id,
              category: "OPERATING_EXPENSE",
              direction: "OUT",
              amount: commissionAmount,
              description: expense.description,
              occurredAt: confirmation.paidAt,
            },
          });
          await notifyCustomer(tx, affiliate.id, {
            branchId: payment.branchId,
            type: "FINANCE",
            title: `Đã ghi nhận hoa hồng Affiliate ${money(commissionAmount)}`,
            body: `${customerName} đã mua ${customerPackage.packagePlan.name} qua mã ${affiliateCampaign.code}. Đối soát theo kỳ ${AFFILIATE_RECONCILIATION_DAYS} ngày.`,
            actionUrl: "/vi?tab=income",
          });
        }
      }
    }
    if (customerId) {
      await notifyCustomer(tx, customerId, {
        branchId: payment.branchId,
        type: "PAYMENT",
        title: `Đã kích hoạt ${customerPackage.packagePlan.name}`,
        body: `${customerPackage.sessionsTotal} buổi · giá trị ${money(payment.amount)} · hạn dùng ${customerPackage.packagePlan.validityDays} ngày.`,
        actionUrl: "/toi",
      });
    }
    await notifyOperations(tx, {
      branchId: payment.branchId,
      type: "FINANCE",
      title: `Đã bán gói thành viên · ${customerName}`,
      body: `${customerPackage.packagePlan.name} · ${money(payment.amount)} đã được đối soát và ghi nhận doanh thu.`,
      actionUrl: "/admin/finance",
    });
    return { payment: updatedPayment, tipAmount: 0, idempotent: false };
  }

  if (payment.type === "SERVICE_PAYMENT" && businessEvent) {
    const businessTipAmount = 0;
    const completedAt = confirmation.paidAt;
    await tx.officeEvent.update({
      where: { id: businessEvent.id },
      data: {
        paidAmount: businessEvent.totalAmount,
        paymentStatus: "PAID",
        status: "COMPLETED",
        actualEndedAt: businessEvent.actualEndedAt ?? completedAt,
        completedAt,
        sessionsUsed: Math.min(businessEvent.sessionsTotal, businessEvent.sessionsUsed + 1),
      },
    });
    const revenue = await tx.ledgerEntry.findFirst({
      where: { officeEventId: businessEvent.id, category: "SERVICE_REVENUE" },
      select: { id: true },
    });
    if (!revenue) {
      await tx.ledgerEntry.create({
        data: {
          branchId: payment.branchId,
          customerId,
          officeEventId: businessEvent.id,
          paymentTransactionId: payment.id,
          category: "SERVICE_REVENUE",
          direction: "IN",
          amount: businessEvent.totalAmount,
          description: `Doanh thu Tâm An Business · ${businessEvent.eventCode}`,
          occurredAt: completedAt,
        },
      });
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { totalSpend: { increment: businessEvent.totalAmount }, totalVisits: { increment: 1 }, lastVisitAt: completedAt },
        });
      }
    }
    await markBusinessLeadStage(tx, businessEvent.id, "WON");
    if (customerId) {
      await notifyCustomer(tx, customerId, {
        branchId: businessEvent.branchId,
        type: "PAYMENT",
        title: "Tâm An Business đã hoàn tất thanh toán",
        body: `Bill ${money(businessEvent.totalAmount)} đã được đối soát. Tip tùy tâm được trao trực tiếp cho KTV và không nằm trong Bill. Mời bạn đánh giá trải nghiệm.`,
        actionUrl: `/doanh-nghiep/${businessEvent.eventCode}`,
      });
    }
    await notifyOperations(tx, {
      branchId: businessEvent.branchId,
      type: "FINANCE",
      title: `Đã hoàn tất Business · ${businessEvent.companyName}`,
      body: `Doanh thu Bill ${money(businessEvent.totalAmount)} · đã chốt giờ và công nợ; không bao gồm Tip trực tiếp cho KTV.`,
      actionUrl: `/admin/business/${businessEvent.eventCode}`,
    });
    return { payment: updatedPayment, tipAmount: businessTipAmount, idempotent: false };
  }

  if (payment.type === "SERVICE_PAYMENT") {
    if (group) {
      await tx.bookingGroup.update({ where: { id: group.id }, data: { paidAmount: group.totalAmount, paymentStatus: "PAID" } });
      for (const booking of bookings) {
        await tx.booking.update({ where: { id: booking.id }, data: { paidAmount: booking.totalAmount, paymentStatus: "PAID" } });
      }
    } else if (directBooking) {
      await tx.booking.update({ where: { id: directBooking.id }, data: { paidAmount: directBooking.totalAmount, paymentStatus: "PAID" } });
    }

    const billTotal = group?.totalAmount ?? directBooking?.totalAmount ?? payment.amount;
    const platformFeeAmount = bookings.reduce((sum, booking) => sum + booking.depositAmount, 0);
    for (const booking of bookings) {
      const revenueExists = await tx.ledgerEntry.findFirst({
        where: { bookingId: booking.id, category: "SERVICE_REVENUE" },
        select: { id: true },
      });
      if (!revenueExists && booking.totalAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            branchId: booking.branchId,
            customerId,
            bookingId: booking.id,
            bookingGroupId: group?.id,
            paymentTransactionId: payment.id,
            category: "SERVICE_REVENUE",
            direction: "IN",
            amount: booking.totalAmount,
            description: `${booking.service.name} · ${referenceCode}`,
            occurredAt: confirmation.paidAt,
          },
        });
      }
      if (booking.depositAmount > 0) {
        const feeExists = await tx.ledgerEntry.findFirst({
          where: { bookingId: booking.id, category: "PLATFORM_FEE" },
          select: { id: true },
        });
        if (!feeExists) {
          await tx.ledgerEntry.create({
            data: {
              branchId: booking.branchId,
              customerId,
              bookingId: booking.id,
              bookingGroupId: group?.id,
              paymentTransactionId: payment.id,
              category: "PLATFORM_FEE",
              direction: "OUT",
              amount: booking.depositAmount,
              description: `Phí nền tảng Xgroup · ${referenceCode}`,
              occurredAt: confirmation.paidAt,
            },
          });
        }
      }
    }

    if (customerId) {
      await notifyCustomer(tx, customerId, {
        branchId: payment.branchId,
        type: "PAYMENT",
        title: "Đã đối soát thanh toán dịch vụ",
        body: `Bill đã được quầy xác nhận thanh toán đủ ${money(billTotal)}. Tip tùy tâm được trao trực tiếp cho KTV và không nằm trong giao dịch này.`,
        actionUrl: "/vi",
      });
    }
    await notifyOperations(tx, {
      branchId: payment.branchId,
      type: "FINANCE",
      title: `Đã đối soát Bill · ${customerName}`,
      body: `${referenceCode} · doanh thu Bill ${money(billTotal)} · phí nền tảng Xgroup ${money(platformFeeAmount)} · doanh thu đối tác cơ sở trước chi phí vận hành ${money(Math.max(0, billTotal - platformFeeAmount))}. Không bao gồm Tip trực tiếp cho KTV.`,
      actionUrl: "/admin/finance",
    });
  }

  return { payment: updatedPayment, tipAmount, idempotent: false };
}
