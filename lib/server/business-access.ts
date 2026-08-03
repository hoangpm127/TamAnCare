import "server-only";

import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { therapistForSession } from "@/lib/server/therapist-session";

export async function businessRequestIdentity() {
  const admin = await getAdminSession();
  const customer = await getCustomerSession();
  const guest = await getGuestSession();
  return {
    admin: admin && !admin.mustChangePassword ? admin : null,
    customer,
    guest,
  };
}

export async function canAccessBusinessEvent(event: { id: string; branchId: string; customerId: string | null; leadTherapistId: string | null }) {
  const identity = await businessRequestIdentity();
  if (identity.admin) {
    if (identity.admin.role === "OWNER") return { allowed: true, identity, kind: "ADMIN" as const };
    if (["BRANCH_MANAGER", "RECEPTIONIST"].includes(identity.admin.role) && identity.admin.branchId === event.branchId) {
      return { allowed: true, identity, kind: "ADMIN" as const };
    }
    if (identity.admin.role === "THERAPIST" && identity.admin.branchId === event.branchId) {
      const therapist = await therapistForSession(identity.admin);
      if (therapist?.id === event.leadTherapistId) return { allowed: true, identity, kind: "THERAPIST" as const };
    }
  }
  if (identity.customer?.customerId === event.customerId) return { allowed: true, identity, kind: "CUSTOMER" as const };
  if (identity.guest) {
    const grant = await db.businessAccessGrant.findFirst({
      where: { guestSessionId: identity.guest.id, officeEventId: event.id, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (grant) return { allowed: true, identity, kind: "GUEST" as const };
  }
  return { allowed: false, identity, kind: null };
}
