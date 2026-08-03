import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { officeRegistrationSchema } from "@/lib/validations";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { consumeRateLimit, isSameOriginMutation } from "@/lib/server/request-security";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const body = await request.json();
  const parsed = officeRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid office registration", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const guestSession = await ensureGuestSession();
    const phone = parsed.data.phone.replace(/\D/g, "");
    const rateLimit = await consumeRateLimit({
      scope: "office-registration",
      identifier: `${guestSession.id}:${phone}`,
      limit: 8,
      windowMs: 60 * 60_000,
      blockMs: 10 * 60_000,
    });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Bạn đã gửi quá nhiều đăng ký. Vui lòng thử lại sau." }, { status: 429 });
    const event = await db.officeEvent.findUnique({ where: { eventCode: parsed.data.eventCode } });
    if (!event) {
      return NextResponse.json({ error: "Office event not found" }, { status: 404 });
    }

    if (!["DEPOSIT_CONFIRMED", "READY"].includes(event.status)) {
      return NextResponse.json({ error: "Đoàn Business chưa mở đăng ký hoặc đã kết thúc." }, { status: 409 });
    }
    const slotTime = new Date(parsed.data.slotTime);
    const offset = slotTime.getTime() - event.startsAt.getTime();
    if (slotTime < event.startsAt || slotTime >= event.endsAt || offset % (event.slotMinutes * 60_000) !== 0) {
      return NextResponse.json({ error: "Khung giờ không thuộc lịch triển khai của đoàn." }, { status: 409 });
    }

    const registration = await db.$transaction(async (tx) => {
      const existing = await tx.officeRegistration.findFirst({
        where: { eventId: event.id, phone, status: { not: "CANCELLED" } },
      });
      if (existing) return existing;
      const registered = await tx.officeRegistration.count({ where: { eventId: event.id, status: { not: "CANCELLED" } } });
      if (registered >= event.headcount) throw new Error("office_event_full");
      const customer = await tx.customer.upsert({
        where: { phone },
        create: {
          fullName: parsed.data.fullName,
          phone,
          firstSource: `Office event ${event.eventCode}`,
          commonIssues: [],
        },
        update: { fullName: parsed.data.fullName },
      });
      const created = await tx.officeRegistration.create({
        data: {
          eventId: event.id,
          customerId: customer.id,
          fullName: parsed.data.fullName,
          phone,
          slotTime,
          voucherCode: event.voucherCode,
        },
      });
      await notifyCustomer(tx, customer.id, {
        branchId: event.branchId,
        type: "BOOKING",
        title: "Đã đăng ký chăm sóc tại văn phòng",
        body: `${event.companyName} · khung giờ của bạn đã được ghi nhận${event.voucherCode ? ` · ưu đãi ${event.voucherCode}` : ""}.`,
        actionUrl: "/thong-bao",
      });
      await notifyOperations(tx, {
        branchId: event.branchId,
        type: "BOOKING",
        title: `Đăng ký Business mới · ${parsed.data.fullName}`,
        body: `${event.companyName} · ${new Date(parsed.data.slotTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`,
        actionUrl: "/admin/office-events",
      });
      return created;
    });

    return NextResponse.json({ registration, voucherCode: event.voucherCode });
  } catch (error) {
    if (error instanceof Error && error.message === "office_event_full") {
      return NextResponse.json({ error: "Đoàn Business đã đủ số người đăng ký." }, { status: 409 });
    }
    console.error("office_registration.create_failed", error);
    return NextResponse.json({ error: "Không thể lưu đăng ký Business. Vui lòng thử lại." }, { status: 503 });
  }
}
