import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessBusinessEvent } from "@/lib/server/business-access";

export async function GET(_request: Request, context: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await context.params;
  const event = await db.officeEvent.findUnique({
    where: { eventCode },
    include: {
      branch: true,
      customer: true,
      leadTherapist: true,
      payments: { orderBy: { createdAt: "asc" } },
      ledgerEntries: { orderBy: { occurredAt: "asc" } },
      tipPayout: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Không tìm thấy hồ sơ Tâm An Business." }, { status: 404 });
  const access = await canAccessBusinessEvent(event);
  if (!access.allowed) return NextResponse.json({ error: "Bạn không có quyền xem hồ sơ này." }, { status: 401 });
  return NextResponse.json({
    event: {
      ...event,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      actualStartedAt: event.actualStartedAt?.toISOString() ?? null,
      expectedEndAt: event.expectedEndAt?.toISOString() ?? null,
      actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
      completedAt: event.completedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      customer: event.customer ? { fullName: event.customer.fullName, phone: event.customer.phone } : null,
      payments: event.payments.map((payment) => ({ id: payment.id, type: payment.type, status: payment.status, amount: payment.amount, receivedAmount: payment.receivedAmount, paymentCode: payment.paymentCode, paidAt: payment.paidAt?.toISOString() ?? null })),
      ledgerEntries: access.kind === "ADMIN" ? event.ledgerEntries : undefined,
    },
    viewer: access.kind,
  });
}
