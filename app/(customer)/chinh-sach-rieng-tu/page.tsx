import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { LEGAL_DOCUMENTS } from "@/lib/server/legal-documents";

export const metadata: Metadata = { title: "Chính sách bảo vệ dữ liệu · Tâm An Center" };

export default function PrivacyPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.PRIVACY} />;
}
