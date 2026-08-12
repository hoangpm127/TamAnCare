import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { z } from "zod";
import { money, notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { bookingWindowError } from "@/lib/scheduling-policy";
import { therapistWorksDuring } from "@/lib/server/therapist-schedule";
import { isCustomerAudienceRequest } from "@/lib/request-audience";
import { BOOKING_POLICY } from "@/lib/business-policy";
import { activeBedWhere } from "@/lib/server/facility-operations";

const schema = z.object({
  newStartTime: z.string().min(16),
  bankCode: z.string().max(30).optional(),
});

class RescheduleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function parseBusinessDateTime(value: string) {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.slice(0, 19)}+07:00`);
}

function monthKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(value).replace("/", "-");
}

function businessParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export async function POST(request: Request, context: { params: Promise<{ bookingCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const { bookingCode } = await context.params;
  const [adminCandidate, customerCandidate, activeGuest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const customerAudience = isCustomerAudienceRequest(request);
  const activeAdmin = !customerAudience && adminCandidate && !adminCandidate.mustChangePassword ? adminCandidate : null;
  const activeCustomer = customerCandidate;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lịch mới chưa hợp lệ." }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      const direct = await tx.booking.findUnique({ where: { bookingCode }, include: { group: true } });
      const directGroup = direct ? null : await tx.bookingGroup.findUnique({ where: { referenceCode: bookingCode } });
      const groupId = direct?.groupId ?? directGroup?.id;
      const group = direct?.group ?? directGroup;
      const bookings = groupId
        ? await tx.booking.findMany({ where: { groupId }, include: { service: true }, orderBy: { startTime: "asc" } })
        : direct
          ? [await tx.booking.findUniqueOrThrow({ where: { id: direct.id }, include: { service: true } })]
          : [];
      if (!bookings.length) throw new Error("Không tìm thấy booking.");
      if (!["PENDING", "CONFIRMED", "NO_SHOW"].includes(group?.status ?? bookings[0].status)) throw new Error("Booking đã hủy hoặc đang phục vụ không thể dùng lại; vui lòng tạo lịch mới.");

      const customerId = group?.customerId ?? bookings[0].customerId;
      const branchId = group?.branchId ?? bookings[0].branchId;
      const referenceCode = group?.referenceCode ?? bookings[0].bookingCode;
      const depositAmount = group?.depositAmount ?? bookings.reduce((sum, item) => sum + item.depositAmount, 0);
      if (activeAdmin) {
        if (["INVESTOR", "THERAPIST"].includes(activeAdmin.role)) throw new RescheduleError("Vai trò hiện tại không có quyền đổi lịch khách hàng.", 403);
        if (activeAdmin.role !== "OWNER" && activeAdmin.branchId !== branchId) throw new RescheduleError("Bạn không có quyền đổi booking ngoài cơ sở phụ trách.", 403);
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
        if (!ownsBooking && !guestVerified) throw new RescheduleError("Cần đăng nhập hoặc mở booking trên đúng thiết bị đã đặt lịch.", 401);
        const currentStart = bookings.reduce((earliest, item) => item.startTime < earliest ? item.startTime : earliest, bookings[0].startTime);
        if (currentStart.getTime() - Date.now() < BOOKING_POLICY.rescheduleNoticeMinutes * 60_000) {
          throw new RescheduleError(`Cần báo đổi lịch trước ít nhất ${BOOKING_POLICY.rescheduleNoticeMinutes} phút.`, 409);
        }
      }
      const key = monthKey(new Date());
      const existingPolicy = await tx.customerMonthlyPolicy.findUnique({ where: { customerId_monthKey: { customerId, monthKey: key } } });
      const requiresAdditionalDeposit = (existingPolicy?.rescheduleCount ?? 0) >= 1;

      const firstStart = parseBusinessDateTime(parsed.data.newStartTime);
      if (firstStart < addMinutes(new Date(), BOOKING_POLICY.minimumLeadMinutes)) {
        throw new Error(`Khung giờ mới cần cách hiện tại ít nhất ${BOOKING_POLICY.minimumLeadMinutes} phút.`);
      }
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      const startParts = businessParts(firstStart);
      const reservedTherapists = new Set<string>();
      const reservedRooms = new Set<string>();
      const assignments: { bookingId: string; start: Date; end: Date; therapistId: string; roomId: string }[] = [];

      for (const booking of bookings) {
        const start = firstStart;
        const end = addMinutes(start, booking.durationMin);
        const scheduleError = bookingWindowError({
          startMinute: startParts.minuteOfDay,
          durationMinutes: booking.durationMin,
          openTime: branch.openTime,
          closeTime: branch.closeTime,
          lastBookingTime: branch.lastBookingTime,
        });
        if (scheduleError) throw new Error(scheduleError);
        const therapists = await tx.therapist.findMany({
          where: { branchId, status: "ACTIVE", onlineBooking: true, services: { some: { id: booking.serviceId } } },
          orderBy: { ratingAvg: "desc" },
          include: { weeklySchedules: { where: { isActive: true }, select: { weekday: true, startMinute: true, endMinute: true, isActive: true } } },
        });
        const rooms = await tx.room.findMany({ where: { branchId, AND: [activeBedWhere()], suitableCategories: { has: booking.service.category } }, orderBy: { name: "asc" } });
        const conflicts = await tx.booking.findMany({
          where: {
            branchId,
            id: { notIn: bookings.map((item) => item.id) },
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] },
            startTime: { lt: addMinutes(end, branch.bufferMinutes) },
            endTime: { gt: addMinutes(start, -branch.bufferMinutes) },
          },
          select: { therapistId: true, roomId: true },
        });
        const therapist = therapists.find((item) => therapistWorksDuring(item.weeklySchedules, start, end) && !reservedTherapists.has(item.id) && !conflicts.some((conflict) => conflict.therapistId === item.id));
        const room = rooms.find((item) => !reservedRooms.has(item.id) && !conflicts.some((conflict) => conflict.roomId === item.id));
        if (!therapist || !room) throw new Error("Khung giờ mới vừa hết chỗ. Vui lòng chọn giờ khác.");
        reservedTherapists.add(therapist.id);
        reservedRooms.add(room.id);
        assignments.push({ bookingId: booking.id, start, end, therapistId: therapist.id, roomId: room.id });
      }

      if (requiresAdditionalDeposit && depositAmount > 0) {
        const attempt = (existingPolicy?.rescheduleCount ?? 0) + 1;
        const idempotencyKey = `reschedule:${referenceCode}:${attempt}`;
        let payment = await tx.paymentTransaction.findUnique({ where: { idempotencyKey } });
        if (!payment) {
          payment = await tx.paymentTransaction.create({
            data: {
              bookingGroupId: groupId,
              bookingId: groupId ? undefined : bookings[0].id,
              branchId,
              customerId,
              type: "DEPOSIT",
              direction: "IN",
              status: "PENDING",
              amount: depositAmount,
              method: "BANK_TRANSFER_SEPAY",
              bankCode: parsed.data.bankCode,
              paymentCode: buildPaymentCode(`${referenceCode}-DL-${attempt}`, "DEPOSIT"),
              idempotencyKey,
              note: `Cọc mới cho lần đổi lịch thứ ${attempt} trong tháng; chờ ngân hàng đối soát.`,
            },
          });
        }
        if (payment.status !== "CONFIRMED") {
          if (activeAdmin) {
            await tx.adminAuditLog.create({
              data: {
                actorUserId: activeAdmin.id,
                branchId,
                action: "BOOKING_RESCHEDULE_PAYMENT_INTENT",
                entityType: "PaymentTransaction",
                entityId: payment.id,
                before: { status: group?.status ?? bookings[0].status, rescheduleCount: existingPolicy?.rescheduleCount ?? 0 },
                after: { amount: payment.amount, paymentStatus: payment.status, requestedStartTime: firstStart.toISOString() },
                ipHash: privateIdentifierDigest(requestIp(request)),
              },
            });
          }
          return {
            requiresPayment: true,
            additionalDepositAmount: depositAmount,
            rescheduleCount: existingPolicy?.rescheduleCount ?? 0,
            payment: {
              id: payment.id,
              status: payment.status,
              amount: payment.amount,
              paymentCode: payment.paymentCode,
            },
          };
        }
      }

      const targetStatus = depositAmount > 0 && (group?.paymentStatus ?? bookings[0].paymentStatus) === "UNPAID"
        ? "PENDING"
        : "CONFIRMED";
      for (const assignment of assignments) {
        await tx.booking.update({
          where: { id: assignment.bookingId },
          data: {
            startTime: assignment.start,
            endTime: assignment.end,
            therapistId: assignment.therapistId,
            roomId: assignment.roomId,
            status: targetStatus,
            rescheduleCount: { increment: 1 },
            lastRescheduledAt: new Date(),
          },
        });
      }

      const policy = await tx.customerMonthlyPolicy.upsert({
        where: { customerId_monthKey: { customerId, monthKey: key } },
        create: { customerId, monthKey: key, rescheduleCount: 1 },
        update: { rescheduleCount: { increment: 1 } },
      });

      if (requiresAdditionalDeposit && depositAmount > 0) {
        const forfeitureDescription = `Cọc cũ không bảo lưu sau lần đổi lịch thứ ${policy.rescheduleCount} · ${referenceCode}`;
        const forfeitureExists = await tx.ledgerEntry.findFirst({ where: { description: forfeitureDescription } });
        if (!forfeitureExists) {
          await tx.ledgerEntry.create({
            data: {
              branchId,
              customerId,
              bookingGroupId: groupId,
              bookingId: groupId ? undefined : bookings[0].id,
              category: "DEPOSIT_FORFEITURE",
              direction: "IN",
              amount: depositAmount,
              description: forfeitureDescription,
            },
          });
        }
        await tx.customerMonthlyPolicy.update({ where: { id: policy.id }, data: { forfeitedDepositAmount: { increment: depositAmount } } });
      }

      if (groupId) await tx.bookingGroup.update({ where: { id: groupId }, data: { status: targetStatus } });
      await notifyCustomer(tx, customerId, {
        branchId,
        type: "BOOKING",
        title: targetStatus === "PENDING" ? "Đã đổi khung giờ · Chờ đối soát cọc" : "Đã đổi lịch thành công",
        body: targetStatus === "PENDING"
          ? "Khung giờ mới đã được cập nhật nhưng chỉ được xác nhận sau khi ngân hàng đối soát khoản cọc."
          : requiresAdditionalDeposit
            ? "Lịch mới và khoản cọc mới đã được ghi nhận."
            : "Đây là lượt đổi lịch được bảo lưu cọc đầu tiên trong tháng.",
        actionUrl: "/don-cua-toi?tab=upcoming",
      });
      await notifyOperations(tx, {
        branchId,
        type: requiresAdditionalDeposit ? "FINANCE" : "BOOKING",
        title: "Khách đã đổi lịch thành công",
        body: `${referenceCode} · lần đổi thứ ${policy.rescheduleCount} trong tháng${requiresAdditionalDeposit ? ` · cọc mới ${money(depositAmount)}` : " · bảo lưu cọc cũ"}.`,
        actionUrl: requiresAdditionalDeposit ? "/admin/finance" : "/admin/bookings",
      });
      if (activeAdmin) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: activeAdmin.id,
            branchId,
            action: "BOOKING_RESCHEDULE",
            entityType: groupId ? "BookingGroup" : "Booking",
            entityId: groupId ?? bookings[0].id,
            before: {
              status: group?.status ?? bookings[0].status,
              startsAt: bookings.map((item) => item.startTime.toISOString()),
              rescheduleCount: existingPolicy?.rescheduleCount ?? 0,
            },
            after: {
              status: targetStatus,
              startTime: firstStart.toISOString(),
              rescheduleCount: policy.rescheduleCount,
              additionalDepositAmount: requiresAdditionalDeposit ? depositAmount : 0,
            },
            ipHash: privateIdentifierDigest(requestIp(request)),
          },
        });
      }
      return { requiresPayment: false, additionalDepositAmount: requiresAdditionalDeposit ? depositAmount : 0, rescheduleCount: policy.rescheduleCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ ok: true, ...result }, { status: result.requiresPayment ? 402 : 200 });
  } catch (error) {
    if (error instanceof RescheduleError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đổi lịch." }, { status: 409 });
  }
}
