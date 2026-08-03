import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAccessBusinessEvent } from "@/lib/server/business-access";
import { saveBusinessReview, BusinessFlowError } from "@/lib/server/business-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

export async function POST(request: Request, context: { params: Promise<{ eventCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Đánh giá chưa hợp lệ." }, { status: 400 });
  const { eventCode } = await context.params;
  const event = await db.officeEvent.findUnique({ where: { eventCode } });
  if (!event) return NextResponse.json({ error: "Không tìm thấy hồ sơ Business." }, { status: 404 });
  const access = await canAccessBusinessEvent(event);
  if (!access.allowed || !["CUSTOMER", "GUEST"].includes(access.kind ?? "")) return NextResponse.json({ error: "Bạn không có quyền đánh giá hồ sơ này." }, { status: 401 });
  try {
    const saved = await db.$transaction((tx) => saveBusinessReview(tx, eventCode, parsed.data.rating, parsed.data.comment));
    return NextResponse.json({ persisted: true, rating: saved.customerRating, comment: saved.customerComment });
  } catch (error) {
    if (error instanceof BusinessFlowError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
