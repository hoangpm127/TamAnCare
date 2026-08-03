import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureGuestSession } from "@/lib/server/guest-session";
import { BusinessFlowError, endBusinessService, sendBusinessEndReminder, startBusinessService } from "@/lib/server/business-service";
import { verifyBusinessQrToken } from "@/lib/server/business-qr";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const schema = z.object({ action: z.enum(["START", "END", "REMIND"]), bankCode: z.string().trim().max(40).optional() });

async function verifiedEvent(token: string) {
  const payload = verifyBusinessQrToken(token);
  if (!payload) return null;
  const event = await db.officeEvent.findUnique({ where: { eventCode: payload.eventCode }, include: { branch: true, leadTherapist: true } });
  if (!event || event.leadTherapistId !== payload.leadTherapistId || event.qrVersion !== payload.version) return null;
  return event;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await verifiedEvent(token);
  if (!event) return NextResponse.json({ error: "Mã QR đã hết hiệu lực hoặc không hợp lệ." }, { status: 404 });
  return NextResponse.json({
    event: {
      eventCode: event.eventCode,
      companyName: event.companyName,
      location: event.location,
      serviceLabel: event.serviceLabel,
      headcount: event.headcount,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      expectedEndAt: event.expectedEndAt?.toISOString() ?? null,
      actualStartedAt: event.actualStartedAt?.toISOString() ?? null,
      actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
      totalAmount: event.totalAmount,
      paidAmount: event.paidAmount,
      dueAmount: Math.max(0, event.totalAmount - Math.min(event.paidAmount, event.totalAmount)),
      leadTherapist: event.leadTherapist?.fullName ?? null,
      branchName: event.branch.name,
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thao tác QR chưa hợp lệ." }, { status: 400 });
  const { token } = await context.params;
  const event = await verifiedEvent(token);
  if (!event) return NextResponse.json({ error: "Mã QR đã hết hiệu lực hoặc không hợp lệ." }, { status: 404 });
  const rate = await consumeRateLimit({ scope: "business-scan", identifier: `${requestIp(request)}:${event.id}`, limit: 30, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau." }, { status: 429 });
  const guest = await ensureGuestSession();
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.businessAccessGrant.upsert({
        where: { guestSessionId_officeEventId: { guestSessionId: guest.id, officeEventId: event.id } },
        create: { guestSessionId: guest.id, officeEventId: event.id, expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
        update: { expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
      });
      if (parsed.data.action === "START") return { event: await startBusinessService(tx, event.eventCode), payment: null, dueAmount: 0 };
      if (parsed.data.action === "REMIND") return { event: await sendBusinessEndReminder(tx, event.eventCode), payment: null, dueAmount: 0 };
      return endBusinessService(tx, event.eventCode, parsed.data.bankCode, guest.id);
    });
    return NextResponse.json({
      persisted: true,
      eventCode: result.event.eventCode,
      status: result.event.status,
      dueAmount: result.dueAmount,
      payment: result.payment ? { id: result.payment.id, status: result.payment.status, amount: result.payment.amount, paymentCode: result.payment.paymentCode } : null,
    });
  } catch (error) {
    if (error instanceof BusinessFlowError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("business.scan_failed", error);
    return NextResponse.json({ error: "Không thể cập nhật phiên Tâm An Business." }, { status: 503 });
  }
}
