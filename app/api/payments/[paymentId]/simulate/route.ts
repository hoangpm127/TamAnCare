import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { confirmIncomingPayment, PaymentReconciliationError } from "@/lib/server/payment-service";
import { isSameOriginMutation } from "@/lib/server/request-security";
import { z } from "zod";

function simulationEnabled() {
  return process.env.APP_ENV === "uat" && process.env.ENABLE_UAT_PAYMENT_SIMULATION === "true";
}

const bodySchema = z.object({
  actualAmount: z.coerce.number().int().positive().max(50_000_000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  if (!simulationEnabled()) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const { paymentId } = await context.params;
  const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
  if (!payment || !["DEPOSIT", "SERVICE_PAYMENT"].includes(payment.type)) return NextResponse.json({ error: "Không tìm thấy khoản thanh toán." }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Số tiền kiểm thử chưa hợp lệ." }, { status: 400 });

  const [admin, customer, guest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const adminAllowed = Boolean(admin && !admin.mustChangePassword && !["INVESTOR", "THERAPIST"].includes(admin.role) && (admin.role === "OWNER" || admin.branchId === payment.branchId));
  const customerAllowed = Boolean(customer && payment.customerId === customer.customerId);
  const guestAllowed = Boolean(guest && await db.paymentAccessGrant.findFirst({
    where: { guestSessionId: guest.id, paymentTransactionId: payment.id, expiresAt: { gt: new Date() } },
    select: { id: true },
  }));
  if (!adminAllowed && !customerAllowed && !guestAllowed) return NextResponse.json({ error: "Không tìm thấy khoản cọc." }, { status: 404 });

  try {
    const confirmation = await db.$transaction((tx) => confirmIncomingPayment(tx, payment.id, {
      actualAmount: payment.type === "SERVICE_PAYMENT" ? (parsed.data.actualAmount ?? payment.amount) : payment.amount,
      externalReference: `uat-simulation:${payment.id}`,
      paidAt: new Date(),
      method: "BANK_TRANSFER_UAT_SIMULATION",
      bankCode: payment.bankCode ?? undefined,
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ simulated: true, idempotent: confirmation.idempotent, status: "CONFIRMED", tipAmount: confirmation.tipAmount });
  } catch (error) {
    if (error instanceof PaymentReconciliationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ simulated: true, idempotent: true, status: "CONFIRMED" });
    }
    console.error("payment.uat_simulation_failed", error);
    return NextResponse.json({ error: "Không thể mô phỏng đối soát UAT." }, { status: 503 });
  }
}
