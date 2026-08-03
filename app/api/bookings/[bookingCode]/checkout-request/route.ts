import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import { isCustomerAudienceRequest } from "@/lib/request-audience";

class CheckoutRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: Request, context: { params: Promise<{ bookingCode: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }

  const { bookingCode } = await context.params;
  const [adminCandidate, customerSession, guestSession] = await Promise.all([
    getAdminSession(),
    getCustomerSession(),
    getGuestSession(),
  ]);
  const activeAdmin = !isCustomerAudienceRequest(request) && adminCandidate
    && !adminCandidate.mustChangePassword
    && ["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(adminCandidate.role)
    ? adminCandidate
    : null;

  try {
    const result = await db.$transaction(async (tx) => {
      const directBooking = await tx.booking.findUnique({
        where: { bookingCode },
        include: { group: true, customer: true, service: true, therapist: true },
      });
      const directGroup = directBooking
        ? null
        : await tx.bookingGroup.findUnique({ where: { referenceCode: bookingCode }, include: { customer: true } });
      const groupId = directBooking?.groupId ?? directGroup?.id;
      const group = directBooking?.group ?? directGroup;
      const bookings = groupId
        ? await tx.booking.findMany({
            where: { groupId },
            include: { service: true, therapist: true },
            orderBy: { startTime: "asc" },
          })
        : directBooking
          ? [directBooking]
          : [];

      if (!bookings.length) throw new CheckoutRequestError("Không tìm thấy Bill dịch vụ.", 404);

      const customerId = group?.customerId ?? bookings[0].customerId;
      const branchId = group?.branchId ?? bookings[0].branchId;
      const referenceCode = group?.referenceCode ?? bookings[0].bookingCode;
      const customer = directBooking?.customer ?? directGroup?.customer;
      const ownsBooking = customerSession?.customerId === customerId;
      const adminAuthorized = activeAdmin
        ? activeAdmin.role === "OWNER" || activeAdmin.branchId === branchId
        : false;
      const guestVerified = guestSession
        ? Boolean(await tx.bookingAccessGrant.findFirst({
            where: {
              guestSessionId: guestSession.id,
              expiresAt: { gt: new Date() },
              ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
            },
            select: { id: true },
          }))
        : false;

      if (!adminAuthorized && !ownsBooking && !guestVerified) {
        throw new CheckoutRequestError("Cần mở Bill trên đúng tài khoản hoặc thiết bị đã đặt lịch.", 401);
      }

      const currentStatus = group?.status ?? bookings[0].status;
      if (!["CHECKED_IN", "IN_SERVICE"].includes(currentStatus)) {
        throw new CheckoutRequestError("Chỉ có thể check-out sớm khi dịch vụ đang được tính giờ.", 409);
      }

      const existingRequestedAt = bookings.find((item) => item.checkoutRequestedAt)?.checkoutRequestedAt;
      const totalAmount = group?.totalAmount ?? bookings.reduce((sum, item) => sum + item.totalAmount, 0);
      const paidAmount = group?.paidAmount ?? bookings.reduce((sum, item) => sum + item.paidAmount, 0);
      const dueAmount = Math.max(0, totalAmount - Math.min(totalAmount, paidAmount));
      if (existingRequestedAt) {
        return {
          checkoutRequestedAt: existingRequestedAt.toISOString(),
          dueAmount,
          idempotent: true,
        };
      }

      const checkoutRequestedAt = new Date();
      const serviceStartedAt = bookings.find((item) => item.checkedInAt)?.checkedInAt ?? checkoutRequestedAt;
      const actualMinutes = Math.max(0, Math.round((checkoutRequestedAt.getTime() - serviceStartedAt.getTime()) / 60_000));
      await tx.booking.updateMany({
        where: { id: { in: bookings.map((item) => item.id) } },
        data: { checkoutRequestedAt },
      });

      const checkoutTime = checkoutRequestedAt.toLocaleTimeString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
      });
      await notifyCustomer(tx, customerId, {
        branchId,
        type: "BOOKING",
        title: "Đã ghi nhận yêu cầu check-out sớm",
        body: `${referenceCode} đã dừng tính giờ lúc ${checkoutTime}. ${dueAmount > 0 ? `Phần còn lại ${money(dueAmount)} sẽ được đối soát trước khi đóng Bill.` : "Cơ sở đang xác nhận hoàn tất Bill."}`,
        actionUrl: `/check-in?bookingCode=${referenceCode}`,
      });
      await notifyOperations(tx, {
        branchId,
        type: "BOOKING",
        title: `Khách yêu cầu check-out sớm · ${customer?.fullName ?? "Khách Tâm An"}`,
        body: `${referenceCode} dừng tính giờ lúc ${checkoutTime} · đã phục vụ khoảng ${actualMinutes} phút${dueAmount > 0 ? ` · còn đối soát ${money(dueAmount)}` : " · không còn công nợ dịch vụ"}.`,
        actionUrl: "/admin/bookings",
      });
      for (const booking of bookings) {
        await notifyTherapist(tx, {
          branchId,
          therapistName: booking.therapist?.fullName,
          type: "BOOKING",
          title: `Khách check-out sớm · ${customer?.fullName ?? "Khách Tâm An"}`,
          body: `${booking.service.name} · ${referenceCode}. Đồng hồ đã dừng lúc ${checkoutTime}; vui lòng phối hợp quầy xác nhận hoàn tất.`,
          actionUrl: `/therapist/bookings/${booking.bookingCode}`,
        });
      }
      if (activeAdmin) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: activeAdmin.id,
            branchId,
            action: "BOOKING_EARLY_CHECKOUT_REQUEST",
            entityType: groupId ? "BookingGroup" : "Booking",
            entityId: groupId ?? bookings[0].id,
            before: { status: currentStatus, checkoutRequestedAt: null },
            after: { status: currentStatus, checkoutRequestedAt: checkoutRequestedAt.toISOString(), referenceCode },
            ipHash: privateIdentifierDigest(requestIp(request)),
          },
        });
      }

      return {
        checkoutRequestedAt: checkoutRequestedAt.toISOString(),
        dueAmount,
        idempotent: false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CheckoutRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("booking.checkout_request_failed", error);
    return NextResponse.json({ error: "Không thể ghi nhận yêu cầu check-out sớm." }, { status: 503 });
  }
}
