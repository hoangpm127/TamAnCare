import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviewSchema } from "@/lib/validations";
import { getCustomerSession } from "@/lib/server/customer-session";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { getGuestSession, hasGuestBookingAccess } from "@/lib/server/guest-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const [account, guest] = await Promise.all([getCustomerSession(), getGuestSession()]);
  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    let booking = await db.booking.findUnique({ where: { bookingCode: parsed.data.bookingCode }, include: { customer: true, therapist: true } });
    const group = booking
      ? null
      : await db.bookingGroup.findUnique({
          where: { referenceCode: parsed.data.bookingCode },
          include: { bookings: { include: { customer: true, therapist: true }, orderBy: { startTime: "asc" }, take: 1 } },
        });
    booking = booking ?? group?.bookings[0] ?? null;
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const ownsBooking = account?.customerId === booking.customerId;
    const guestVerified = guest
      ? await hasGuestBookingAccess({
          guestSessionId: guest.id,
          ...(group ? { bookingGroupId: group.id } : { bookingId: booking.id }),
        })
      : false;
    if (!ownsBooking && !guestVerified) return NextResponse.json({ error: "Cần đăng nhập hoặc mở booking trên đúng thiết bị đã đặt lịch." }, { status: 401 });
    if (booking.status !== "COMPLETED") return NextResponse.json({ error: "Chỉ có thể đánh giá sau khi dịch vụ hoàn tất." }, { status: 409 });

    const review = await db.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          customerId: booking.customerId,
          therapistId: booking.therapistId,
          rating: parsed.data.rating,
          comment: parsed.data.comment,
          wantsRebook: parsed.data.wantsRebook ?? false,
        },
        update: {
          rating: parsed.data.rating,
          comment: parsed.data.comment,
          wantsRebook: parsed.data.wantsRebook ?? false,
        },
      });
      if (booking.therapistId) {
        const aggregate = await tx.review.aggregate({ where: { therapistId: booking.therapistId }, _avg: { rating: true } });
        await tx.therapist.update({
          where: { id: booking.therapistId },
          data: {
            ratingAvg: aggregate._avg.rating ?? booking.therapist?.ratingAvg ?? 5,
            ...(parsed.data.wantsRebook ? { repeatCount: { increment: 1 } } : {}),
          },
        });
      }
      await notifyCustomer(tx, booking.customerId, {
        branchId: booking.branchId,
        type: "SYSTEM",
        title: "Cảm ơn bạn đã đánh giá",
        body: `Đánh giá ${parsed.data.rating}/5 sao cho ${booking.therapist?.fullName ?? "đội ngũ Tâm An"} đã được ghi nhận.`,
        actionUrl: "/don-cua-toi?tab=history",
      });
      await notifyOperations(tx, {
        branchId: booking.branchId,
        type: parsed.data.rating <= 3 ? "REMINDER" : "SYSTEM",
        title: `${parsed.data.rating <= 3 ? "Cần chăm sóc lại" : "Khách đã đánh giá"} · ${booking.customer.fullName}`,
        body: `${parsed.data.rating}/5 sao · ${booking.bookingCode}${parsed.data.wantsRebook ? " · muốn đặt lại KTV" : ""}.`,
        actionUrl: `/admin/customers/${booking.customerId}`,
      });
      return saved;
    });

    return NextResponse.json({ persisted: true, review });
  } catch (error) {
    console.error("review.create_failed", error);
    return NextResponse.json({ error: "Không thể lưu đánh giá." }, { status: 503 });
  }
}
