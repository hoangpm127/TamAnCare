import { cookies } from "next/headers";
import { CustomerShell } from "@/components/customer-nav";
import { CustomerLanguageProvider } from "@/components/customer-language-provider";
import { PublicCatalogProvider } from "@/lib/catalog-store";
import { CUSTOMER_LANGUAGE_COOKIE_KEY, isCustomerLanguage, type CustomerLanguage } from "@/lib/customer-i18n";
import { getPublicCatalog } from "@/lib/server/public-catalog";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, catalog] = await Promise.all([cookies(), getPublicCatalog()]);
  const storedLanguage = cookieStore.get(CUSTOMER_LANGUAGE_COOKIE_KEY)?.value;
  const initialLanguage: CustomerLanguage = isCustomerLanguage(storedLanguage) ? storedLanguage : "vi";

  return (
    <PublicCatalogProvider initialCatalog={catalog}>
      <CustomerLanguageProvider initialLanguage={initialLanguage}>
        <CustomerShell>{children}</CustomerShell>
      </CustomerLanguageProvider>
    </PublicCatalogProvider>
  );
}
