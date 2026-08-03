import { NextResponse } from "next/server";
import { expireUnpaidBookingHolds } from "@/lib/server/booking-dal";
import { isCronAuthorized } from "@/lib/server/cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Không có quyền chạy tác vụ." }, { status: 401 });
  const expired = await expireUnpaidBookingHolds();
  return NextResponse.json({ success: true, expired });
}
