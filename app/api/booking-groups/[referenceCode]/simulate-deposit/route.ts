import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { bookingGroupToDto, getBookingGroupByReference } from "@/lib/server/booking-dal";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession, hasGuestBookingAccess } from "@/lib/server/guest-session";
import { confirmIncomingPayment, PaymentReconciliationError } from "@/lib/server/payment-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

function simulationEnabled() {
  return process.env.APP_ENV === "uat" && process.env.ENABLE_UAT_PAYMENT_SIMULATION === "true";
}

export async function POST(request: Request, context: { params: Promise<{ referenceCode: string }> }) {
  if (!simulationEnabled()) return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const { referenceCode } = await context.params;
  const group = await getBookingGroupByReference(referenceCode);
  if (!group) return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 });
  const [admin, customer, guest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const adminAllowed = Boolean(admin && !admin.mustChangePassword && !["INVESTOR", "THERAPIST"].includes(admin.role) && (admin.role === "OWNER" || admin.branchId === group.branchId));
  const customerAllowed = customer?.customerId === group.customerId;
  const guestAllowed = guest ? await hasGuestBookingAccess({ guestSessionId: guest.id, bookingGroupId: group.id }) : false;
  if (!adminAllowed && !customerAllowed && !guestAllowed) return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 });

  const payment = group.payments.find((item) => item.type === "DEPOSIT");
  if (!payment) return NextResponse.json({ error: "Booking không có khoản cọc cần đối soát." }, { status: 409 });

  try {
    await db.$transaction(async (tx) => {
      await confirmIncomingPayment(tx, payment.id, {
        actualAmount: payment.amount,
        externalReference: `uat-simulation:${payment.id}`,
        paidAt: new Date(),
        method: "BANK_TRANSFER_UAT_SIMULATION",
        bankCode: payment.bankCode ?? undefined,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const updated = await getBookingGroupByReference(referenceCode);
    return NextResponse.json({ simulated: true, booking: updated ? bookingGroupToDto(updated) : null });
  } catch (error) {
    if (error instanceof PaymentReconciliationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const updated = await getBookingGroupByReference(referenceCode);
      return NextResponse.json({ simulated: true, idempotent: true, booking: updated ? bookingGroupToDto(updated) : null });
    }
    console.error("payment.uat_simulation_failed", error);
    return NextResponse.json({ error: "Không thể mô phỏng đối soát UAT." }, { status: 503 });
  }
}
