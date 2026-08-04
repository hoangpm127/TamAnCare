import { AdminNav } from "@/components/admin-nav";
import { AdminGuard, AdminSessionProvider } from "@/components/admin-session-provider";
import { PublicCatalogProvider } from "@/lib/catalog-store";
import { getAdminSession } from "@/lib/server/admin-session";
import { getPublicCatalog } from "@/lib/server/public-catalog";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, catalog] = await Promise.all([getAdminSession(), getPublicCatalog()]);
  if (!session) redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  if (session.mustEnrollMfa) redirect("/bao-mat-quan-tri");
  if (session.role === "THERAPIST") redirect("/therapist");
  if (session.role === "XGROUP_SUPER_ADMIN" || session.role === "DISTRICT_SALES_MANAGER") redirect("/xgroup");
  return (
    <PublicCatalogProvider initialCatalog={catalog}>
      <AdminSessionProvider initialSession={session}>
        <AdminGuard>
          <main className="min-h-screen bg-[#fdf8f3] text-[#281b18]">
            <AdminNav />
            <div className="pb-20 md:pb-10">{children}</div>
          </main>
        </AdminGuard>
      </AdminSessionProvider>
    </PublicCatalogProvider>
  );
}
