import { CustomerShell } from "@/components/customer-nav";
import { CustomerLanguageProvider } from "@/components/customer-language-provider";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLanguageProvider><CustomerShell>{children}</CustomerShell></CustomerLanguageProvider>;
}
