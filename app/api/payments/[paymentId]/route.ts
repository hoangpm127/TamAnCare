import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";

export async function GET(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await context.params;
  const payment = await db.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: { customerPackage: true },
  });
  if (!payment) return NextResponse.json({ error: "Không tìm thấy giao dịch." }, { status: 404 });
  const [adminCandidate, customer, guest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const adminAllowed = Boolean(
    adminCandidate
    && !adminCandidate.mustChangePassword
    && adminCandidate.role !== "INVESTOR"
    && (adminCandidate.role === "OWNER" || adminCandidate.branchId === payment.branchId),
  );
  const customerAllowed = Boolean(customer && payment.customerId === customer.customerId);
  let guestAllowed = false;
  if (guest) {
    guestAllowed = Boolean(await db.paymentAccessGrant.findFirst({
      where: { guestSessionId: guest.id, paymentTransactionId: payment.id, expiresAt: { gt: new Date() } },
      select: { id: true },
    }));
    if (!guestAllowed && (payment.bookingGroupId || payment.bookingId)) {
      guestAllowed = Boolean(await db.bookingAccessGrant.findFirst({
        where: {
          guestSessionId: guest.id,
          expiresAt: { gt: new Date() },
          ...(payment.bookingGroupId ? { bookingGroupId: payment.bookingGroupId } : { bookingId: payment.bookingId! }),
        },
        select: { id: true },
      }));
    }
  }
  if (!adminAllowed && !customerAllowed && !guestAllowed) {
    return NextResponse.json({ error: "Không tìm thấy giao dịch." }, { status: 404 });
  }
  return NextResponse.json({
    payment: {
      id: payment.id,
      type: payment.type,
      status: payment.status,
      amount: payment.amount,
      receivedAmount: payment.receivedAmount,
      paymentCode: payment.paymentCode,
      paidAt: payment.paidAt?.toISOString(),
      packageStatus: payment.customerPackage?.status,
    },
  });
}
