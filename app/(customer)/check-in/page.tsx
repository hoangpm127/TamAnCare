import { QrCode as QrCodeIcon } from "lucide-react";
import { db } from "@/lib/db";
import { CheckinFlow } from "@/components/checkin-flow";
import { verifyTherapistQrToken } from "@/lib/server/therapist-qr";
import { verifyVenueQrToken } from "@/lib/server/venue-qr";

export const metadata = {
  title: "Check-in tại cơ sở | Tâm An Center",
};

export const dynamic = "force-dynamic";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ bookingCode?: string; ktv?: string; venue?: string }> }) {
  const query = await searchParams;
  const branchRecords = await db.branch.findMany({ orderBy: { id: "asc" } });
  const branches = branchRecords.map((item) => ({ id: item.id, label: item.name.replace(/^Tâm An Center · /, "") }));

  const therapistPayload = query.ktv ? verifyTherapistQrToken(query.ktv) : null;
  const therapistRecord = therapistPayload
    ? await db.therapist.findFirst({
        where: { id: therapistPayload.therapistId, branchId: therapistPayload.branchId, qrVersion: therapistPayload.version, status: "ACTIVE" },
        select: { id: true, branchId: true, fullName: true },
      })
    : null;
  const venuePayload = query.venue ? verifyVenueQrToken(query.venue) : null;
  const venueRecord = venuePayload
    ? branchRecords.find((item) => item.id === venuePayload.branchId && item.qrVersion === venuePayload.version)
    : null;

  return (
    <main className="mx-auto max-w-md px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <QrCodeIcon className="text-[#d13f1f]" size={20} />
        <h1 className="text-xl font-semibold tracking-tight">{therapistRecord ? `Check-in cùng ${therapistRecord.fullName}` : "Check-in tại cơ sở"}</h1>
      </div>
      <CheckinFlow branches={branches} initialBookingCode={query.bookingCode} initialBranchId={venueRecord?.id} initialTherapist={therapistRecord ? { id: therapistRecord.id, branchId: therapistRecord.branchId, name: therapistRecord.fullName } : undefined} />
    </main>
  );
}
