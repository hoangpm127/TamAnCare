import { notFound } from "next/navigation";
import { XgroupDashboardPage } from "@/components/xgroup-dashboard-page";
import type { XgroupSection } from "@/lib/xgroup-types";

export const dynamic = "force-dynamic";

const SECTIONS = ["finance", "districts", "affiliates", "assets", "reconciliation"] as const;

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) notFound();
  return <XgroupDashboardPage section={section as XgroupSection} />;
}

