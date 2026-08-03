import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QrCode } from "lucide-react";
import { TherapistQrCard } from "@/components/therapist-qr-card";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { createTherapistQrToken, therapistCheckinUrl } from "@/lib/server/therapist-qr";

export const dynamic = "force-dynamic";

export default async function TherapistQrCollectionPage() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "therapists")) notFound();
  const therapists = await db.therapist.findMany({
    where: {
      status: "ACTIVE",
      ...(session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" }),
    },
    include: { branch: { select: { name: true } } },
    orderBy: [{ branchId: "asc" }, { fullName: "asc" }],
  });
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;
  const cards = await Promise.all(therapists.map(async (therapist) => {
    const token = createTherapistQrToken({ therapistId: therapist.id, branchId: therapist.branchId, version: therapist.qrVersion });
    return {
      therapist,
      dataUrl: await QRCode.toDataURL(therapistCheckinUrl(token, origin), { width: 420, margin: 1, errorCorrectionLevel: "H", color: { dark: "#173d36", light: "#ffffff" } }),
    };
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="rounded-2xl bg-gradient-to-r from-[#173d36] to-[#22845a] p-5 text-center text-white shadow-lg">
        <QrCode className="mx-auto" size={26} />
        <h1 className="mt-2 text-xl font-semibold">Bộ QR riêng của KTV</h1>
        <p className="mt-1 text-xs leading-5 text-white/75">Tải để in, hoặc KTV mở trực tiếp trên điện thoại. Khách quét đúng QR sẽ vào Bill đã phân công cho KTV đó.</p>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ therapist, dataUrl }) => <TherapistQrCard key={therapist.id} compact dataUrl={dataUrl} therapistName={therapist.fullName} branchLabel={therapist.branch.name.replace(/^Tâm An Center · /, "")} />)}
      </div>
    </main>
  );
}
