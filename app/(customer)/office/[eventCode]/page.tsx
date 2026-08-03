import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OfficeRegistrationForm, type OfficeEventRegistrationView } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function OfficeEventPage({ params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params;
  const event = await db.officeEvent.findUnique({
    where: { eventCode },
    select: {
      eventCode: true,
      companyName: true,
      location: true,
      startsAt: true,
      endsAt: true,
      slotMinutes: true,
      voucherCode: true,
      status: true,
      headcount: true,
      _count: { select: { registrations: { where: { status: { not: "CANCELLED" } } } } },
    },
  });
  if (!event) notFound();

  const view: OfficeEventRegistrationView = {
    ...event,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    registered: event._count.registrations,
  };

  return <OfficeRegistrationForm event={view} />;
}
