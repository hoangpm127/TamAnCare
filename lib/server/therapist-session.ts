import "server-only";

import type { AdminAccount } from "@/lib/admin-auth";
import { db } from "@/lib/db";

/**
 * Resolve the operational KTV behind an authenticated staff account.
 * The explicit relation is authoritative. The name/branch fallback keeps
 * pre-migration sessions usable until users sign in again.
 */
export async function therapistForSession(session: AdminAccount) {
  if (session.role !== "THERAPIST" || !session.branchId) return null;
  if (session.therapistId) {
    const linked = await db.therapist.findFirst({
      where: { id: session.therapistId, branchId: session.branchId, status: "ACTIVE" },
    });
    if (linked) return linked;
  }
  return db.therapist.findFirst({
    where: { branchId: session.branchId, fullName: session.displayName, status: "ACTIVE" },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });
}
