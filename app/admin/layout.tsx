import { AdminNav } from "@/components/admin-nav";
import { AdminGuard, AdminSessionProvider } from "@/components/admin-session-provider";
import { getAdminSession } from "@/lib/server/admin-session";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  if (session.mustEnrollMfa) redirect("/bao-mat-quan-tri");
  if (session.role === "THERAPIST") redirect("/therapist");
  if (session.role === "XGROUP_SUPER_ADMIN" || session.role === "DISTRICT_SALES_MANAGER") redirect("/xgroup");
  return (
    <AdminSessionProvider initialSession={session}>
      <AdminGuard>
        <main className="min-h-screen bg-[#fffaf6] text-[#191414]">
          <AdminNav />
          <div className="pb-20 md:pb-10">{children}</div>
        </main>
      </AdminGuard>
    </AdminSessionProvider>
  );
}
