import { cookies } from "next/headers";
import { CustomerShell } from "@/components/customer-nav";
import { CustomerLanguageProvider } from "@/components/customer-language-provider";
import { CUSTOMER_LANGUAGE_COOKIE_KEY, type CustomerLanguage } from "@/lib/customer-i18n";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialLanguage: CustomerLanguage =
    cookieStore.get(CUSTOMER_LANGUAGE_COOKIE_KEY)?.value === "ko" ? "ko" : "vi";

  return (
    <CustomerLanguageProvider initialLanguage={initialLanguage}>
      <CustomerShell>{children}</CustomerShell>
    </CustomerLanguageProvider>
  );
}
