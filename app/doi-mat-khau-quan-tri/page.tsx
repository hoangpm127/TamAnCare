import { redirect } from "next/navigation";
import { AdminChangePasswordClient } from "@/components/admin-change-password-client";
import { getAdminSession } from "@/lib/server/admin-session";
import { adminLandingPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminChangePasswordPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dang-nhap-quan-tri");
  if (!session.mustChangePassword) redirect(adminLandingPath(session.role));
  return <AdminChangePasswordClient displayName={session.displayName} role={session.role} mustEnrollMfa={session.mustEnrollMfa} />;
}
