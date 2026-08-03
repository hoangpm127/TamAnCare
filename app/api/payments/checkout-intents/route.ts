import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  bookingCode: z.string().trim().min(8),
  bankCode: z.string().trim().max(40).optional(),
  tipAmount: z.coerce.number().int().min(0).max(20_000_000).default(0),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Booking chưa hợp lệ." }, { status: 400 });
  const [adminCandidate, customer, guest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const admin = adminCandidate && !adminCandidate.mustChangePassword ? adminCandidate : null;

  const rateLimit = await consumeRateLimit({
    scope: "checkout-intent-create",
    identifier: admin?.id ?? customer?.customerId ?? guest?.id ?? requestIp(request),
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Bạn đã tạo quá nhiều yêu cầu thanh toán. Vui lòng liên hệ quầy." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

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
      if (!bookings.length) throw new CheckoutIntentError("Không tìm thấy booking.", 404);

      const branchId = group?.branchId ?? bookings[0].branchId;
      const customerId = group?.customerId ?? bookings[0].customerId;
      const referenceCode = group?.referenceCode ?? bookings[0].bookingCode;
      const bookingStatus = group?.status ?? bookings[0].status;
      const adminAllowed = Boolean(
        admin
        && !["INVESTOR", "THERAPIST"].includes(admin.role)
        && (admin.role === "OWNER" || admin.branchId === branchId),
      );
      const customerAllowed = customer?.customerId === customerId;
      const guestAllowed = guest
        ? Boolean(await tx.bookingAccessGrant.findFirst({
            where: {
              guestSessionId: guest.id,
              expiresAt: { gt: new Date() },
              ...(groupId ? { bookingGroupId: groupId } : { bookingId: bookings[0].id }),
            },
            select: { id: true },
          }))
        : false;
      if (!adminAllowed && !customerAllowed && !guestAllowed) {
        throw new CheckoutIntentError("Cần mở booking trên đúng tài khoản hoặc thiết bị đã đặt lịch.", 401);
      }
      if (!["CHECKED_IN", "IN_SERVICE"].includes(bookingStatus)) {
        throw new CheckoutIntentError("Chỉ mở thanh toán phần còn lại khi khách đã check-in dịch vụ.", 409);
      }

      const totalAmount = group?.totalAmount ?? bookings.reduce((sum, item) => sum + item.totalAmount, 0);
      const recordedPaid = group?.paidAmount ?? bookings.reduce((sum, item) => sum + item.paidAmount, 0);
      const dueAmount = Math.max(0, totalAmount - Math.min(recordedPaid, totalAmount));
      const minimumTipAmount = 0;
      if (parsed.data.tipAmount > 0) {
        throw new CheckoutIntentError(
          "Tip hoàn toàn tùy tâm và được trao trực tiếp cho KTV. Vui lòng không chuyển Tip chung với Bill dịch vụ.",
          409,
        );
      }
      if (dueAmount === 0) {
        return { paid: true, dueAmount: 0, minimumTipAmount, payment: null };
      }

      const existing = await tx.paymentTransaction.findUnique({ where: { idempotencyKey: `checkout:${referenceCode}` } });
      if (existing) {
        return {
          paid: existing.status === "CONFIRMED",
          dueAmount,
          minimumTipAmount,
          payment: existing,
        };
      }
      const payment = await tx.paymentTransaction.create({
        data: {
          bookingGroupId: groupId,
          bookingId: groupId ? undefined : bookings[0].id,
          branchId,
          customerId,
          type: "SERVICE_PAYMENT",
          direction: "IN",
          status: "PENDING",
          amount: dueAmount,
          method: "BANK_TRANSFER_SEPAY",
          bankCode: parsed.data.bankCode,
          paymentCode: buildPaymentCode(referenceCode, "SERVICE_PAYMENT"),
          idempotencyKey: `checkout:${referenceCode}`,
          note: "Thanh toán chính xác phần còn lại của Bill dịch vụ; Tip tùy tâm trao trực tiếp cho KTV và không chuyển chung.",
        },
      });
      return { paid: false, dueAmount, minimumTipAmount, payment };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      paid: result.paid,
      dueAmount: result.dueAmount,
      minimumTipAmount: result.minimumTipAmount,
      payment: result.payment ? {
        id: result.payment.id,
        status: result.payment.status,
        amount: result.payment.amount,
        receivedAmount: result.payment.receivedAmount,
        paymentCode: result.payment.paymentCode,
        paidAt: result.payment.paidAt?.toISOString(),
      } : null,
    }, { status: result.payment ? 201 : 200 });
  } catch (error) {
    if (error instanceof CheckoutIntentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("payment.checkout_intent_failed", error);
    return NextResponse.json({ error: "Không thể tạo yêu cầu thanh toán Bill." }, { status: 503 });
  }
}

class CheckoutIntentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CheckoutIntentError";
  }
}
