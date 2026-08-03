import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BusinessLeadConsole } from "@/components/business-lead-console";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { businessScanUrl, createBusinessQrToken } from "@/lib/server/business-qr";
import { therapistForSession } from "@/lib/server/therapist-session";

export const dynamic = "force-dynamic";

export default async function TherapistBusinessPage({ params }: { params: Promise<{ eventCode: string }> }) {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) redirect("/therapist");
  const { eventCode } = await params;
  const event = await db.officeEvent.findUnique({ where: { eventCode }, include: { leadTherapist: true } });
  if (!event) notFound();
  if (!event.leadTherapist || event.leadTherapist.id !== therapist.id || event.branchId !== therapist.branchId) redirect("/therapist");
  const token = createBusinessQrToken({ eventCode: event.eventCode, leadTherapistId: event.leadTherapist.id, version: event.qrVersion });
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;
  const qrDataUrl = await QRCode.toDataURL(businessScanUrl(token, origin), { width: 420, margin: 1, errorCorrectionLevel: "H", color: { dark: "#241614", light: "#ffffff" } });
  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><BusinessLeadConsole qrDataUrl={qrDataUrl} initialEvent={{ eventCode: event.eventCode, companyName: event.companyName, location: event.location, headcount: event.headcount, requiredTherapists: event.requiredTherapists, status: event.status, actualStartedAt: event.actualStartedAt?.toISOString() ?? null, expectedEndAt: event.expectedEndAt?.toISOString() ?? null, actualEndedAt: event.actualEndedAt?.toISOString() ?? null }} /></div>;
}
