import { BusinessScanClient } from "@/components/business-scan-client";

export const dynamic = "force-dynamic";

export default async function BusinessScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BusinessScanClient token={token} />;
}
