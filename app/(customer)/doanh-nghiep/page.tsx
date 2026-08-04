import { CorporateClient } from "./corporate-client";
import { getBusinessCatalog } from "@/lib/server/business-catalog";

export default async function CorporatePage() {
  const businessCatalog = await getBusinessCatalog();
  return <CorporateClient businessCatalog={businessCatalog} />;
}
