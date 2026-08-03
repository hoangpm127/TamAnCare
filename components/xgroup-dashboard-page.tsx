import { redirect } from "next/navigation";
import { XgroupDashboardClient } from "@/components/xgroup-dashboard-client";
import { getXgroupDashboard } from "@/lib/server/xgroup-dashboard";
import { requireXgroupSession } from "@/lib/server/xgroup-access";
import type { XgroupSection } from "@/lib/xgroup-types";

export async function XgroupDashboardPage({ section }: { section: XgroupSection }) {
  const session = await requireXgroupSession();
  if (!session) redirect("/dang-nhap-quan-tri");
  const initialData = await getXgroupDashboard(session);
  return <XgroupDashboardClient initialData={initialData} activeSection={section} />;
}

