import { NextResponse } from "next/server";
import { BookingConflictError, bookingGroupToDto, createBookingGroup } from "@/lib/server/booking-dal";
import { bookingGroupSchema } from "@/lib/validations";
import { getCustomerSession } from "@/lib/server/customer-session";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { installedReferralForIdentity } from "@/lib/server/referral-installation";
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
    const installedReferral = await installedReferralForIdentity({
      guestSessionId: guestSession.id,
      customerId: customerSession?.customerId,
    });
    const group = await createBookingGroup({
      ...parsed.data,
      // The server-side binding is authoritative after an invitation has been
      // attached to an account. Do not depend on browser storage surviving an
      // app install, logout, or a switch between browser and installed PWA.
      // Never trust a campaign code retained in localStorage. It may belong to
      // a deleted test campaign or another account on the same phone.
      campaignCode: installedReferral?.code,
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
