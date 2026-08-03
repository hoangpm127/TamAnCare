import { RescheduleAccessClient } from "./reschedule-client";

export default async function ReschedulePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RescheduleAccessClient bookingCode={code} />;
}
