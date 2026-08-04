import { notFound } from "next/navigation";
import { AdminFinanceAccess } from "@/components/admin-finance-access";
import { getAdminSession } from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER"].includes(session.role)) notFound();

  return <AdminFinanceAccess />;
}
