import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({ therapistId: z.string().trim().min(1) });

export async function POST(request: Request, context: { params: Promise<{ eventCode: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền phân công KTV trưởng." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "KTV được chọn chưa hợp lệ." }, { status: 400 });
  const { eventCode } = await context.params;
  const event = await db.officeEvent.findUnique({ where: { eventCode } });
  if (!event) return NextResponse.json({ error: "Không tìm thấy hồ sơ Business." }, { status: 404 });
  if (session.role !== "OWNER" && session.branchId !== event.branchId) return NextResponse.json({ error: "Hồ sơ không thuộc cơ sở của bạn." }, { status: 403 });
  const therapist = await db.therapist.findFirst({ where: { id: parsed.data.therapistId, branchId: event.branchId, status: "ACTIVE" } });
  if (!therapist) return NextResponse.json({ error: "KTV không hoạt động tại cơ sở hạch toán này." }, { status: 409 });
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.officeEvent.update({
      where: { id: event.id },
      data: {
        leadTherapistId: therapist.id,
        qrVersion: { increment: 1 },
        status: event.status === "DEPOSIT_CONFIRMED" ? "READY" : undefined,
      },
    });
    await notifyTherapist(tx, {
      therapistName: therapist.fullName,
      branchId: event.branchId,
      type: "BOOKING",
      title: `Bạn là KTV Business trưởng · ${event.companyName}`,
      body: `${event.location} · mở hồ sơ để trình QR bắt đầu/kết thúc cho khách.`,
      actionUrl: `/therapist/business/${event.eventCode}`,
    });
    if (event.customerId) {
      await notifyCustomer(tx, event.customerId, {
        branchId: event.branchId,
        type: "BOOKING",
        title: `Đã phân công KTV Business trưởng`,
        body: `${therapist.fullName} sẽ điều phối buổi phục vụ tại ${event.location}.`,
        actionUrl: `/doanh-nghiep/${event.eventCode}`,
      });
    }
    await notifyOperations(tx, {
      branchId: event.branchId,
      type: "BOOKING",
      title: `Đã phân công Business · ${event.companyName}`,
      body: `${therapist.fullName} là KTV trưởng; mã QR cũ đã tự động hết hiệu lực.`,
      actionUrl: `/admin/business/${event.eventCode}`,
    });
    return saved;
  });
  return NextResponse.json({ persisted: true, event: { eventCode: updated.eventCode, status: updated.status, leadTherapist: therapist.fullName } });
}
