import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { LEGAL_DOCUMENTS } from "@/lib/server/legal-documents";

export const metadata: Metadata = { title: "Điều khoản sử dụng · Tâm An Center" };

export default function TermsPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.TERMS} />;
}
