import { NextResponse } from "next/server";
import { BookingConflictError, bookingGroupToDto, createBookingGroup } from "@/lib/server/booking-dal";
import { bookingGroupSchema } from "@/lib/validations";
import { getCustomerSession } from "@/lib/server/customer-session";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { installedReferralForGuest } from "@/lib/server/referral-installation";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu đặt lịch không hợp lệ." }, { status: 403 });
  const parsed = bookingGroupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin đặt lịch chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [guestSession, customerSession] = await Promise.all([ensureGuestSession(), getCustomerSession()]);
    const rateLimit = await consumeRateLimit({
      scope: "booking-create-v2",
      // Không dùng IP làm danh tính chính: nhiều khách tại cùng Wi-Fi của cơ sở
      // hoặc một người vừa tạo tài khoản sẽ không chặn lẫn nhau.
      identifier: customerSession?.customerId ?? guestSession.id,
      limit: customerSession ? 30 : 15,
      windowMs: 60 * 60_000,
      blockMs: 10 * 60_000,
    });
    if (!rateLimit.allowed) {
      const retryMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
      return NextResponse.json(
        { error: `Bạn đã tạo nhiều lịch trong thời gian ngắn. Vui lòng thử lại sau khoảng ${retryMinutes} phút hoặc kiểm tra Đơn của tôi để tránh đặt trùng.` },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    const userAgent = request.headers.get("user-agent")?.trim();
    const installedReferral = await installedReferralForGuest(guestSession.id);
    const group = await createBookingGroup({
      ...parsed.data,
      guestSessionId: guestSession.id,
      authenticatedCustomerId: customerSession?.customerId,
      installedReferralCampaignId: installedReferral?.campaignId,
      consent: {
        subjectHash: privateIdentifierDigest(parsed.data.customerPhone.replace(/\s+/g, "")),
        ipHash: privateIdentifierDigest(requestIp(request)),
        userAgentHash: userAgent ? privateIdentifierDigest(userAgent) : undefined,
      },
    });
    return NextResponse.json({ persisted: true, booking: bookingGroupToDto(group) }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("booking_group.create_failed", error);
    return NextResponse.json({ error: "Không thể lưu booking. Vui lòng thử lại hoặc liên hệ cơ sở." }, { status: 503 });
  }
}
