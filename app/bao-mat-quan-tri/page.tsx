import { redirect } from "next/navigation";
import { AdminMfaSetupClient } from "@/components/admin-mfa-setup-client";
import { getAdminSession } from "@/lib/server/admin-session";
import { adminLandingPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  if (!["OWNER", "BRANCH_MANAGER", "XGROUP_SUPER_ADMIN", "DISTRICT_SALES_MANAGER"].includes(session.role)) redirect(adminLandingPath(session.role));
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241514] px-4 py-8 text-[#191414]">
      <AdminMfaSetupClient displayName={session.displayName} alreadyEnabled={session.mfaEnabled} landingPath={adminLandingPath(session.role)} />
    </main>
  );
}
