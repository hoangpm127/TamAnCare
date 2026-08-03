import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { LEGAL_DOCUMENTS } from "@/lib/server/legal-documents";

export const metadata: Metadata = { title: "Chính sách đặt lịch và đặt cọc · Tâm An Care" };

export default function BookingPolicyPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.BOOKING_POLICY} />;
}
