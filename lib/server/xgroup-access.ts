import "server-only";

import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import type { AdminAccount } from "@/lib/admin-auth";

const XGROUP_ROLES = ["XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"] as const;

export async function requireXgroupSession() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !XGROUP_ROLES.includes(session.role as (typeof XGROUP_ROLES)[number])) return null;
  return session as AdminAccount & { role: (typeof XGROUP_ROLES)[number] };
}

export async function resolveXgroupScope(session: Awaited<ReturnType<typeof requireXgroupSession>>, requestedDistrictId?: string | null) {
  if (!session) return null;
  if (session.role === "XGROUP_SUPER_ADMIN") {
    return {
      districtId: requestedDistrictId && requestedDistrictId !== "all" ? requestedDistrictId : null,
      canManageAllDistricts: true,
      canApprovePayouts: true,
    };
  }
  const district = await db.businessDistrict.findFirst({
    where: { managerUserId: session.id, isActive: true },
    select: { id: true },
  });
  return {
    districtId: district?.id ?? "__unassigned__",
    canManageAllDistricts: false,
    canApprovePayouts: false,
  };
}

export async function canManageXgroupDistrict(session: NonNullable<Awaited<ReturnType<typeof requireXgroupSession>>>, districtId: string | null | undefined) {
  if (session.role === "XGROUP_SUPER_ADMIN") return true;
  if (!districtId) return false;
  const district = await db.businessDistrict.findFirst({ where: { id: districtId, managerUserId: session.id }, select: { id: true } });
  return Boolean(district);
}

