import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({ message: z.string().trim().min(2).max(1000) });

export async function POST(request: Request, context: { params: Promise<{ bookingCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) return NextResponse.json({ error: "Bạn không có quyền gửi tin nhắn vận hành." }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Nội dung tin nhắn chưa hợp lệ." }, { status: 400 });
  const { bookingCode } = await context.params;
  const direct = await db.booking.findUnique({ where: { bookingCode } });
  const group = direct ? null : await db.bookingGroup.findUnique({ where: { referenceCode: bookingCode } });
  const customerId = direct?.customerId ?? group?.customerId;
  const branchId = direct?.branchId ?? group?.branchId;
  const referenceCode = group?.referenceCode ?? direct?.bookingCode;
  if (!customerId || !branchId || !referenceCode) return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 });
  if (session.role !== "OWNER" && session.branchId !== branchId) return NextResponse.json({ error: "Booking không thuộc cơ sở bạn phụ trách." }, { status: 403 });

  const notification = await notifyCustomer(db, customerId, {
    branchId,
    type: "BOOKING",
    title: `Tin nhắn từ Tâm An · ${referenceCode}`,
    body: parsed.data.message,
    actionUrl: `/don-cua-toi?booking=${encodeURIComponent(referenceCode)}`,
  });
  return NextResponse.json({ persisted: true, notification }, { status: 201 });
}
