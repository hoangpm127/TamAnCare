"use client";

import { AdminDashboardClient } from "@/components/admin-dashboard-client";
import { InvestorDashboardClient } from "@/components/investor-dashboard-client";
import { useAdminSession } from "@/components/admin-session-provider";

export function AdminDashboardRouter() {
  const { session } = useAdminSession();
  return session?.role === "INVESTOR" ? <InvestorDashboardClient /> : <AdminDashboardClient />;
}
