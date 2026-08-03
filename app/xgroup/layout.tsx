import { redirect } from "next/navigation";
import { AdminSessionProvider } from "@/components/admin-session-provider";
import { XgroupShell } from "@/components/xgroup-shell";
import { getAdminSession } from "@/lib/server/admin-session";

export default async function XgroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  if (session.mustEnrollMfa) redirect("/bao-mat-quan-tri");
  if (!['XGROUP_SUPER_ADMIN', 'DISTRICT_SALES_MANAGER'].includes(session.role)) redirect("/admin");
  return <AdminSessionProvider initialSession={session}><XgroupShell>{children}</XgroupShell></AdminSessionProvider>;
}

