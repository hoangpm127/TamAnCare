import { redirect } from "next/navigation";
import { AdminInvestmentOpportunities } from "@/components/admin-investment-opportunities";
import { getAdminSession } from "@/lib/server/admin-session";

export default async function AdminInvestmentOpportunitiesPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "OWNER") redirect("/admin");
  return <AdminInvestmentOpportunities />;
}
