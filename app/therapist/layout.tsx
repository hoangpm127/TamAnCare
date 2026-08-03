import { TherapistNav } from "@/components/therapist-nav";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/admin-session";
import { createTherapistQrToken, therapistCheckinUrl } from "@/lib/server/therapist-qr";
import { therapistForSession } from "@/lib/server/therapist-session";

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  if (session.mustChangePassword) redirect("/doi-mat-khau-quan-tri");
  const therapist = await therapistForSession(session);
  let qrDataUrl: string | null = null;
  if (therapist) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
    const origin = host ? `${protocol}://${host}` : undefined;
    const token = createTherapistQrToken({ therapistId: therapist.id, branchId: therapist.branchId, version: therapist.qrVersion });
    qrDataUrl = await QRCode.toDataURL(therapistCheckinUrl(token, origin), {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#0b4f3c", light: "#ffffff" },
    });
  }
  return (
    <main className="min-h-screen bg-[#fdf8f3] text-[#281b18]">
      <TherapistNav qrDataUrl={qrDataUrl} therapistName={therapist?.fullName ?? session.displayName} branchLabel={session.branchLabel} />
      <div className="pb-20">{children}</div>
    </main>
  );
}
