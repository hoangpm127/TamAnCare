import { NextResponse } from "next/server";
import { Prisma, type BookingStatus } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { reminderSchedule } from "@/lib/reminder";
import { statusSchema } from "@/lib/validations";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { getGuestSession } from "@/lib/server/guest-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { isCustomerAudienceRequest } from "@/lib/request-audience";
import {
  affiliateCommissionAmount,
  affiliateCustomerId,
  affiliateOwnerEligible,
  affiliateVisitEligible,
  AFFILIATE_RECONCILIATION_DAYS,
} from "@/lib/referral-policy";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "IN_SERVICE", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: ["CONFIRMED"],
};

class StatusError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function monthKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" })
    .format(value)
    .replace("/", "-");
}

export async function PATCH(request: Request, context: { params: Promise<{ bookingCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const { bookingCode } = await context.params;
  const [adminCandidate, customerCandidate, activeGuest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const customerAudience = isCustomerAudienceRequest(request);
  const activeAdmin = !customerAudience && adminCandidate && !adminCandidate.mustChangePassword ? adminCandidate : null;
  const activeCustomer = customerCandidate;
  if (!customerAudience && activeAdmin?.role === "INVESTOR") {
    return NextResponse.json({ error: "Vai trò Nhà đầu tư chỉ được xem báo cáo tổng hợp." }, { status: 403 });
  }
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Trạng thái hoặc số tiền chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await db.$transaction(
      async (tx) => {
        const directBooking = await tx.booking.findUnique({
          where: { bookingCode },
          include: { group: true, customer: true, service: true, therapist: true, campaign: true },
        });
        const directGroup = directBooking
          ? null
          : await tx.bookingGroup.findUnique({ where: { referenceCode: bookingCode }, include: { customer: true } });
        const groupId = directBooking?.groupId ?? directGroup?.id;
        const group = directBooking?.group ?? directGroup;
        const bookings = groupId
          ? await tx.booking.findMany({ where: { groupId }, include: { service: true, therapist: true, campaign: true }, orderBy: { startTime: "asc" } })
          : directBooking
            ? [directBooking]
            : [];
        if (!bookings.length) throw new StatusError("Không tìm thấy booking.", 404);

        const currentStatus = group?.status ?? bookings[0].status;
        const nextStatus = parsed.data.status;
        const now = new Date();
        const customerId = group?.customerId ?? bookings[0].customerId;
        const branchId = group?.branchId ?? bookings[0].branchId;
        const referenceCode = group?.referenceCode ?? bookings[0].bookingCode;
        const customer = directBooking?.customer ?? directGroup?.customer;
        const totalAmount = group?.totalAmount ?? bookings.reduce((sum, item) => sum + item.totalAmount, 0);
        const depositAmount = group?.depositAmount ?? bookings.reduce((sum, item) => sum + item.depositAmount, 0);
        const currentPaymentStatus = group?.paymentStatus ?? bookings[0].paymentStatus;
        const paidVenueAccess = parsed.data.venueBranchId === branchId
          && ["DEPOSITED", "PAID"].includes(currentPaymentStatus);
        const venueQrServiceStart = nextStatus === "IN_SERVICE"
          && ["CONFIRMED", "CHECKED_IN"].includes(currentStatus)
          && paidVenueAccess;

        if (nextStatus && nextStatus !== currentStatus && !ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus) && !venueQrServiceStart) {
          throw new StatusError(`Không thể chuyển từ ${currentStatus} sang ${nextStatus}.`, 409);
        }

        if (activeAdmin) {
          if (activeAdmin.role !== "OWNER" && activeAdmin.branchId !== branchId) {
            throw new StatusError("Bạn không có quyền xử lý booking ngoài cơ sở được phân công.", 403);
          }
          if (activeAdmin.role === "THERAPIST") {
            if (nextStatus !== "IN_SERVICE") {
              throw new StatusError("KTV chỉ được bắt đầu ca đã được cơ sở xác nhận.", 403);
            }
            if (bookings.some((item) => item.therapist?.fullName !== activeAdmin.displayName)) {
              throw new StatusError("Booking này không được phân công cho tài khoản KTV hiện tại.", 403);
            }
          }
        } else {
          const ownsBooking = activeCustomer?.customerId === customerId;
          const guestVerified = activeGuest
            ? Boolean(await tx.bookingAccessGrant.findFirst({
                where: {
                  guestSessionId: activeGuest.id,
                  expiresAt: { gt: new Date() },
                  ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
                },
                select: { id: true },
              }))
            : false;
          if (!ownsBooking && !guestVerified) {
            throw new StatusError("Cần đăng nhập hoặc mở booking trên đúng thiết bị đã đặt lịch.", 401);
          }
          if (!nextStatus || !["CHECKED_IN", "IN_SERVICE"].includes(nextStatus) || !paidVenueAccess) {
            throw new StatusError("Khách chỉ được bắt đầu sử dụng Bill đã thanh toán cọc sau khi quét đúng QR tại cơ sở.", 403);
          }
          if (currentStatus === "PENDING") {
            throw new StatusError("Lịch đang chờ Admin/Quản lý xác nhận thủ công nên chưa thể check-in. Khi lịch được xác nhận, nút Camera sẽ mở ngay trong Đơn của tôi.", 409);
          }
        }

        if (!nextStatus || nextStatus === currentStatus) {
          return { status: currentStatus, paymentStatus: group?.paymentStatus ?? bookings[0].paymentStatus, idempotent: true };
        }

        if (nextStatus === "CONFIRMED") {
          if (depositAmount > 0 && !["DEPOSITED", "PAID"].includes(currentPaymentStatus)) {
            throw new StatusError("Khoản cọc chưa được ngân hàng hoặc quản lý đối soát.", 409);
          }
          await tx.booking.updateMany({ where: { id: { in: bookings.map((item) => item.id) } }, data: { status: "CONFIRMED" } });
          if (groupId) await tx.bookingGroup.update({ where: { id: groupId }, data: { status: "CONFIRMED" } });
          await notifyCustomer(tx, customerId, {
            branchId,
            type: "BOOKING",
            title: "Lịch của bạn đã được cơ sở xác nhận",
            body: `${referenceCode} đã sẵn sàng. QR check-in được mở để sử dụng tại đúng cơ sở đã đặt.`,
            actionUrl: `/check-in?bookingCode=${referenceCode}`,
          });
          await notifyOperations(tx, {
            branchId,
            type: "BOOKING",
            title: `Đã xác nhận lịch · ${customer?.fullName ?? "Khách Tâm An"}`,
            body: `${referenceCode} đã chuyển sang trạng thái sẵn sàng check-in.`,
            actionUrl: "/admin/bookings",
          });
          for (const booking of bookings) {
            await notifyTherapist(tx, {
              branchId,
              therapistName: booking.therapist?.fullName,
              type: "BOOKING",
              title: `Lịch đã được xác nhận · ${customer?.fullName ?? "Khách Tâm An"}`,
              body: `${booking.service.name} · ${referenceCode}. Vui lòng xem lịch ca để chuẩn bị phục vụ.`,
              actionUrl: `/therapist/bookings/${booking.bookingCode}`,
            });
          }
        }

        if (nextStatus === "CHECKED_IN" || nextStatus === "IN_SERVICE") {
          const serviceStartedAt = nextStatus === "IN_SERVICE"
            ? bookings.find((item) => item.checkedInAt)?.checkedInAt ?? now
            : now;
          await tx.booking.updateMany({
            where: { id: { in: bookings.map((item) => item.id) } },
            data: { status: nextStatus, checkedInAt: serviceStartedAt, checkoutRequestedAt: null, ...(nextStatus === "IN_SERVICE" ? { endingSoonReminderSentAt: null } : {}) },
          });
          if (groupId) await tx.bookingGroup.update({ where: { id: groupId }, data: { status: nextStatus } });
          if (nextStatus === "CHECKED_IN") {
            await notifyCustomer(tx, customerId, {
              branchId,
              type: "BOOKING",
              title: "Cơ sở đã nhận yêu cầu check-in",
              body: `${referenceCode} đã báo bạn có mặt. Lễ tân đang xếp giường/ghế và KTV sẽ bấm bắt đầu khi sẵn sàng.`,
              actionUrl: `/check-in?bookingCode=${referenceCode}`,
            });
            await notifyOperations(tx, {
              branchId,
              type: "BOOKING",
              title: `Khách đã check-in · ${customer?.fullName ?? "Khách Tâm An"}`,
              body: `${referenceCode} đã có mặt tại cơ sở; lễ tân xác nhận giường/ghế trước khi KTV bắt đầu ca.`,
              actionUrl: "/admin/calendar",
            });
            for (const booking of bookings) {
              await notifyTherapist(tx, {
                branchId,
                therapistName: booking.therapist?.fullName,
                type: "BOOKING",
                title: `Khách đã đến · ${customer?.fullName ?? "Khách Tâm An"}`,
                body: `${booking.service.name} · ${referenceCode}. Vui lòng chuẩn bị và bắt đầu ca trên tài khoản KTV.`,
                actionUrl: `/therapist/bookings/${booking.bookingCode}`,
              });
            }
          }
          if (nextStatus === "IN_SERVICE") {
            await notifyCustomer(tx, customerId, {
              branchId,
              type: "BOOKING",
              title: "Dịch vụ của bạn đã bắt đầu",
              body: `${referenceCode} đang được phục vụ. Đồng hồ thời gian đã bắt đầu${venueQrServiceStart ? " từ lúc bạn xác nhận dùng Bill tại QR cơ sở" : ""} và sẽ dừng khi cơ sở/KTV check-out.`,
              actionUrl: `/check-in?bookingCode=${referenceCode}`,
            });
            await notifyOperations(tx, {
              branchId,
              type: "BOOKING",
              title: `${venueQrServiceStart ? "Khách bắt đầu tính giờ qua QR" : "Khách đã bắt đầu dịch vụ"} · ${customer?.fullName ?? "Khách Tâm An"}`,
              body: `${referenceCode} đang được phục vụ bởi ${bookings.map((item) => item.therapist?.fullName).filter(Boolean).join(", ") || "KTV cơ sở"}. Đồng hồ được tính từ ${serviceStartedAt.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}.`,
              actionUrl: "/admin/calendar",
            });
            for (const booking of bookings) {
              await notifyTherapist(tx, {
                branchId,
                therapistName: booking.therapist?.fullName,
                type: "BOOKING",
                title: `Ca đang tính giờ · ${customer?.fullName ?? "Khách Tâm An"}`,
                body: `${booking.service.name} · ${referenceCode}. Khách đã bắt đầu sử dụng dịch vụ; vui lòng theo dõi ca và thực hiện check-out khi hoàn tất.`,
                actionUrl: `/therapist/bookings/${booking.bookingCode}`,
              });
            }
          }
        }

        if (nextStatus === "CANCELLED") {
          const packageCounts = new Map<string, number>();
          for (const booking of bookings) {
            if (booking.customerPackageId) {
              packageCounts.set(booking.customerPackageId, (packageCounts.get(booking.customerPackageId) ?? 0) + 1);
            }
          }
          for (const [customerPackageId, count] of packageCounts) {
            const customerPackage = await tx.customerPackage.findUnique({ where: { id: customerPackageId } });
            if (!customerPackage) continue;
            const released = Math.min(count, customerPackage.sessionsReserved);
            if (released > 0) {
              await tx.customerPackage.update({
                where: { id: customerPackage.id },
                data: {
                  sessionsRemaining: customerPackage.sessionsRemaining + released,
                  sessionsReserved: customerPackage.sessionsReserved - released,
                  status: customerPackage.expiresAt > now ? "ACTIVE" : "EXPIRED",
                },
              });
            }
          }
          await tx.voucherUsage.updateMany({
            where: { booking: { id: { in: bookings.map((item) => item.id) } }, status: "RESERVED" },
            data: { status: "CANCELLED", expiresAt: null },
          });
          await tx.paymentTransaction.updateMany({
            where: {
              status: "PENDING",
              ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
            },
            data: { status: "VOID", note: `Đã hủy cùng booking ${referenceCode}.` },
          });
          await tx.booking.updateMany({ where: { id: { in: bookings.map((item) => item.id) } }, data: { status: "CANCELLED" } });
          if (groupId) await tx.bookingGroup.update({ where: { id: groupId }, data: { status: "CANCELLED", holdExpiresAt: null } });
          const reason = parsed.data.reason
            ? `${parsed.data.reason} Tâm An sẽ ưu tiên hỗ trợ bạn chọn lịch phù hợp khác.`
            : "Lịch hiện tại cần điều chỉnh. Tâm An sẽ ưu tiên hỗ trợ bạn chọn lịch phù hợp khác.";
          await notifyCustomer(tx, customerId, {
            branchId,
            type: "BOOKING",
            title: "Cơ sở chưa thể xác nhận lịch hẹn",
            body: `${referenceCode}: ${reason}`,
            actionUrl: "/booking",
          });
          await notifyOperations(tx, {
            branchId,
            type: "BOOKING",
            title: `Lịch cần sắp xếp lại · ${customer?.fullName ?? "Khách Tâm An"}`,
            body: `${referenceCode} đã hủy khung cũ; cần theo dõi hỗ trợ khách đổi lịch.`,
            actionUrl: "/admin/bookings",
          });
        }

        if (nextStatus === "NO_SHOW") {
          const key = monthKey(now);
          const policy = await tx.customerMonthlyPolicy.upsert({
            where: { customerId_monthKey: { customerId, monthKey: key } },
            create: { customerId, monthKey: key, noShowCount: 1, recoveryReminderSent: true },
            update: { noShowCount: { increment: 1 } },
          });
          const repeated = policy.noShowCount > 1;
          await tx.booking.updateMany({
            where: { id: { in: bookings.map((item) => item.id) } },
            data: { status: "NO_SHOW", noShowAt: now },
          });
          if (groupId) await tx.bookingGroup.update({ where: { id: groupId }, data: { status: "NO_SHOW" } });
          if (repeated && depositAmount > 0) {
            await tx.customerMonthlyPolicy.update({
              where: { id: policy.id },
              data: { forfeitedDepositAmount: { increment: depositAmount } },
            });
            await tx.ledgerEntry.create({
              data: {
                branchId,
                customerId,
                bookingGroupId: groupId,
                bookingId: groupId ? undefined : bookings[0].id,
                category: "DEPOSIT_FORFEITURE",
                direction: "IN",
                amount: depositAmount,
                description: `Cọc mất do vắng hẹn lặp lại trong tháng · ${referenceCode}`,
              },
            });
          }
          await notifyCustomer(tx, customerId, {
            branchId,
            type: "REMINDER",
            title: repeated ? "Tâm An vẫn sẵn sàng sắp xếp lịch mới" : "Mình đã lỡ lịch hôm nay",
            body: repeated
              ? "Đây là lần vắng hẹn tiếp theo trong tháng nên khoản cọc cũ không còn được bảo lưu. Tâm An sẽ hỗ trợ bạn chọn lịch phù hợp hơn."
              : "Tâm An bảo lưu quyền đổi lịch một lần trong tháng và mời bạn chọn lại thời gian thuận tiện.",
            actionUrl: `/don-cua-toi/doi-lich/${referenceCode}`,
          });
          await notifyOperations(tx, {
            branchId,
            type: repeated ? "FINANCE" : "REMINDER",
            title: `Khách vắng hẹn${repeated ? " · Đã ghi nhận cọc không bảo lưu" : ""}`,
            body: `${customer?.fullName ?? "Khách Tâm An"} · ${referenceCode}${repeated ? ` · ${money(depositAmount)}` : " · cần nhắc lịch khéo léo"}.`,
            actionUrl: repeated ? "/admin/finance" : "/admin/reminders",
          });
        }

        if (nextStatus === "COMPLETED") {
          const confirmedPayments = await tx.paymentTransaction.findMany({
            where: {
              status: "CONFIRMED",
              direction: "IN",
              ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
              type: { in: ["DEPOSIT", "SERVICE_PAYMENT", "TIP"] },
            },
          });
          const collectedForBill = confirmedPayments
            .filter((item) => item.type !== "TIP")
            .reduce((sum, item) => sum + item.amount, 0);
          if (collectedForBill < totalAmount) {
            throw new StatusError(`Bill còn thiếu ${money(totalAmount - collectedForBill)}; hãy đối soát thanh toán trước khi hoàn tất.`, 409);
          }
          const checkoutPayment = confirmedPayments.find((item) => item.type === "SERVICE_PAYMENT");
          const depositPayment = confirmedPayments.find((item) => item.type === "DEPOSIT");
          const tipAmount = confirmedPayments
            .filter((item) => item.type === "TIP")
            .reduce((sum, item) => sum + item.amount, 0);

          const packageCounts = new Map<string, number>();
          for (const [index, booking] of bookings.entries()) {
            const revenueExists = await tx.ledgerEntry.findFirst({ where: { bookingId: booking.id, category: "SERVICE_REVENUE" } });
            if (!revenueExists && booking.totalAmount > 0) {
              await tx.ledgerEntry.create({
                data: {
                  branchId,
                  customerId,
                  bookingId: booking.id,
                  bookingGroupId: groupId,
                  paymentTransactionId: checkoutPayment?.id ?? depositPayment?.id,
                  category: "SERVICE_REVENUE",
                  direction: "IN",
                  amount: booking.totalAmount,
                  description: booking.service.name,
                  occurredAt: now,
                },
              });
            }
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: "COMPLETED",
                paymentStatus: "PAID",
                paidAmount: booking.totalAmount,
                tipAmount: index === 0 ? tipAmount : 0,
                completedAt: now,
              },
            });
            if (booking.therapistId) {
              await tx.therapist.update({ where: { id: booking.therapistId }, data: { servedCount: { increment: 1 } } });
            }
            if (booking.customerPackageId) {
              packageCounts.set(booking.customerPackageId, (packageCounts.get(booking.customerPackageId) ?? 0) + 1);
            }
          }

          for (const [customerPackageId, count] of packageCounts) {
            const customerPackage = await tx.customerPackage.findUnique({ where: { id: customerPackageId } });
            if (!customerPackage) continue;
            const consumed = Math.min(count, customerPackage.sessionsReserved);
            const sessionsReserved = customerPackage.sessionsReserved - consumed;
            const nextPackageStatus = customerPackage.sessionsRemaining === 0 && sessionsReserved === 0
              ? "USED_UP"
              : customerPackage.expiresAt > now
                ? "ACTIVE"
                : "EXPIRED";
            await tx.customerPackage.update({
              where: { id: customerPackage.id },
              data: { sessionsReserved, status: nextPackageStatus },
            });
          }

          if (groupId) {
            await tx.bookingGroup.update({
              where: { id: groupId },
              data: { status: "COMPLETED", paymentStatus: "PAID", paidAmount: totalAmount },
            });
          }
          await tx.customer.update({
            where: { id: customerId },
            data: {
              totalVisits: { increment: 1 },
              totalSpend: { increment: totalAmount },
              lastVisitAt: now,
              segment: "RETURNING",
            },
          });
          const affiliateCampaign = bookings[0].campaign;
          const affiliateVoucherUsage = affiliateCampaign
            ? await tx.voucherUsage.findFirst({
                where: {
                  bookingId: { in: bookings.map((item) => item.id) },
                  status: "CONFIRMED",
                  voucher: { code: "AFF50" },
                },
                select: { id: true },
              })
            : null;
          const affiliateEligible = affiliateVisitEligible({
            totalVisits: customer?.totalVisits ?? 0,
            lastVisitAt: customer?.lastVisitAt ?? null,
            completedAt: now,
          });
          if (affiliateVoucherUsage && affiliateEligible && totalAmount > 0 && affiliateCampaign?.source.startsWith("AFFILIATE:")) {
            const affiliateOwnerCustomerId = affiliateCustomerId(affiliateCampaign.source);
            if (affiliateOwnerCustomerId && affiliateOwnerCustomerId !== customerId) {
              const affiliate = await tx.customer.findUnique({
                where: { id: affiliateOwnerCustomerId },
                include: { account: { select: { phoneVerifiedAt: true } } },
              });
              if (affiliate && affiliateOwnerEligible(affiliate.account, phoneVerificationRequired())) {
                const commissionExists = await tx.ledgerEntry.findFirst({
                  where: {
                    customerId: affiliateOwnerCustomerId,
                    ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
                    category: "OPERATING_EXPENSE",
                    description: { startsWith: "Hoa hồng Affiliate" },
                  },
                });
                if (!commissionExists) {
                  const commissionAmount = affiliateCommissionAmount(totalAmount);
                  const commissionExpense = await tx.expense.create({
                    data: {
                      branchId,
                      category: "MARKETING",
                      description: `Hoa hồng Affiliate · ${affiliateCampaign.code} · ${referenceCode}`,
                      amount: commissionAmount,
                      vendor: affiliate.fullName,
                      occurredAt: now,
                    },
                  });
                  await tx.ledgerEntry.create({
                    data: {
                      branchId,
                      customerId: affiliate.id,
                      bookingId: groupId ? undefined : bookings[0].id,
                      bookingGroupId: groupId,
                      expenseId: commissionExpense.id,
                      category: "OPERATING_EXPENSE",
                      direction: "OUT",
                      amount: commissionAmount,
                      description: commissionExpense.description,
                      occurredAt: now,
                    },
                  });
                  await notifyCustomer(tx, affiliate.id, {
                    branchId,
                    type: "FINANCE",
                    title: `Đã ghi nhận hoa hồng Affiliate ${money(commissionAmount)}`,
                    body: `${customer?.fullName ?? "Khách được giới thiệu"} đã hoàn tất lượt đủ điều kiện qua mã ${affiliateCampaign.code}. Đối soát theo kỳ ${AFFILIATE_RECONCILIATION_DAYS} ngày.`,
                    actionUrl: "/vi?tab=income",
                  });
                  await notifyOperations(tx, {
                    branchId,
                    audience: "MANAGEMENT",
                    type: "FINANCE",
                    title: `Phát sinh hoa hồng Affiliate · ${affiliate.fullName}`,
                    body: `${affiliateCampaign.code} · ${referenceCode} · ${money(commissionAmount)} đã hạch toán vào chi phí Marketing.`,
                    actionUrl: "/admin/finance",
                  });
                }
              }
            }
          }
          for (const reminder of reminderSchedule(now)) {
            await tx.reminder.create({
              data: {
                customerId,
                bookingId: bookings[0].id,
                type: reminder.type,
                title: reminder.title,
                message: reminder.message,
                dueAt: reminder.dueAt,
              },
            });
          }
          await notifyCustomer(tx, customerId, {
            branchId,
            type: "PAYMENT",
            title: packageCounts.size > 0 ? "Đã hoàn tất lượt dịch vụ trong gói" : "Dịch vụ và thanh toán đã hoàn tất",
            body: packageCounts.size > 0
              ? `${referenceCode} đã hoàn tất ${bookings.length} lượt trong gói${tipAmount > 0 ? `; Tip KTV ${money(tipAmount)} được tách riêng và chi cuối ngày` : ""}.`
              : tipAmount > 0
                ? `Bill ${money(totalAmount)} đã thanh toán đủ. Tip KTV ${money(tipAmount)} được tách riêng và chi cuối ngày.`
                : `Bill ${money(totalAmount)} đã thanh toán đầy đủ.`,
            actionUrl: "/vi",
          });
          await notifyOperations(tx, {
            branchId,
            type: "FINANCE",
            title: `Bill đã hoàn tất · ${customer?.fullName ?? "Khách Tâm An"}`,
            body: packageCounts.size > 0
              ? `${referenceCode} · đã sử dụng ${bookings.length} lượt gói${tipAmount > 0 ? ` · Tip KTV ngoài bill ${money(tipAmount)}` : ""}.`
              : `${referenceCode} · doanh thu dịch vụ ${money(totalAmount)}${tipAmount > 0 ? ` · Tip KTV ngoài bill ${money(tipAmount)}` : ""}.`,
            actionUrl: "/admin/finance",
          });
          if (tipAmount > 0) {
            await notifyTherapist(tx, {
              therapistName: bookings[0].therapist?.fullName,
              branchId,
              type: "FINANCE",
              title: `Bạn nhận được Tip ${money(tipAmount)}`,
              body: `${referenceCode} đã hoàn tất. Khoản Tip được tách ngoài Bill và chờ chi cuối ngày.`,
              actionUrl: "/therapist",
            });
          }
        }

        if (activeAdmin) {
          await tx.adminAuditLog.create({
            data: {
              actorUserId: activeAdmin.id,
              branchId,
              action: "BOOKING_STATUS_CHANGE",
              entityType: groupId ? "BookingGroup" : "Booking",
              entityId: groupId ?? bookings[0].id,
              before: { status: currentStatus, paymentStatus: currentPaymentStatus },
              after: { status: nextStatus, referenceCode },
              ipHash: privateIdentifierDigest(requestIp(request)),
            },
          });
        }

        return {
          status: nextStatus,
          paymentStatus: nextStatus === "COMPLETED" ? "PAID" : group?.paymentStatus ?? bookings[0].paymentStatus,
          idempotent: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof StatusError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("booking.status_failed", error);
    return NextResponse.json({ error: "Không thể cập nhật trạng thái booking." }, { status: 503 });
  }
}
