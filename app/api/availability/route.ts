import { NextResponse } from "next/server";
import { getAvailableSlotsFromDatabase } from "@/lib/server/booking-dal";
import { availabilitySchema } from "@/lib/validations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = availabilitySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid availability request", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json({ slots: await getAvailableSlotsFromDatabase(parsed.data) });
  } catch (error) {
    console.error("availability.get_failed", error);
    return NextResponse.json({ error: "Không thể tải lịch trống từ hệ thống." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = availabilitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid availability request", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json({ slots: await getAvailableSlotsFromDatabase(parsed.data) });
  } catch (error) {
    console.error("availability.post_failed", error);
    return NextResponse.json({ error: "Không thể tải lịch trống từ hệ thống." }, { status: 503 });
  }
}
