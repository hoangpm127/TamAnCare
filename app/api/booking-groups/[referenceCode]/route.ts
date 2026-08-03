import { NextResponse } from "next/server";
import { bookingGroupToDto, getBookingGroupByReference } from "@/lib/server/booking-dal";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession, hasGuestBookingAccess } from "@/lib/server/guest-session";

export async function GET(_request: Request, context: { params: Promise<{ referenceCode: string }> }) {
  const { referenceCode } = await context.params;
  const group = await getBookingGroupByReference(referenceCode);
  if (!group) return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 });
  const [admin, customer, guest] = await Promise.all([getAdminSession(), getCustomerSession(), getGuestSession()]);
  const adminAllowed = Boolean(
    admin
    && !admin.mustChangePassword
    && !["INVESTOR", "THERAPIST"].includes(admin.role)
    && (admin.role === "OWNER" || admin.branchId === group.branchId),
  );
  const customerAllowed = customer?.customerId === group.customerId;
  const guestAllowed = guest
    ? await hasGuestBookingAccess({ guestSessionId: guest.id, bookingGroupId: group.id })
    : false;
  if (!adminAllowed && !customerAllowed && !guestAllowed) {
    return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 });
  }
  return NextResponse.json({ booking: bookingGroupToDto(group) });
}
