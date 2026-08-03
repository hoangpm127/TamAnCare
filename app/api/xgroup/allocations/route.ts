import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireXgroupSession } from "@/lib/server/xgroup-access";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["APPROVED", "PAID", "ON_HOLD", "VOID"]),
  bankReference: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireXgroupSession();
  if (!session || session.role !== "XGROUP_SUPER_ADMIN") return NextResponse.json({ error: "Chỉ Xgroup Super Admin được duyệt đối soát." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin đối soát chưa hợp lệ." }, { status: 400 });
  const before = await db.businessAllocation.findUnique({ where: { id: parsed.data.id }, include: { attribution: { include: { officeEvent: { select: { eventCode: true } } } } } });
  if (!before) return NextResponse.json({ error: "Không tìm thấy khoản phân bổ." }, { status: 404 });
  if (parsed.data.status === "APPROVED" && before.status !== "READY") return NextResponse.json({ error: "Khoản phân bổ chỉ được duyệt sau khi dịch vụ hoàn tất." }, { status: 409 });
  if (parsed.data.status === "PAID" && before.status !== "APPROVED") return NextResponse.json({ error: "Cần phê duyệt trước khi xác nhận đã chi." }, { status: 409 });
  if (parsed.data.status === "PAID" && !parsed.data.bankReference?.trim()) return NextResponse.json({ error: "Cần mã giao dịch ngân hàng để khóa đối soát." }, { status: 409 });
  const now = new Date();
  const allocation = await db.businessAllocation.update({
    where: { id: before.id },
    data: {
      status: parsed.data.status,
      approvedAt: parsed.data.status === "APPROVED" ? now : before.approvedAt,
      approvedByUserId: parsed.data.status === "APPROVED" ? session.id : before.approvedByUserId,
      paidAt: parsed.data.status === "PAID" ? now : null,
      bankReference: parsed.data.status === "PAID" ? parsed.data.bankReference : null,
      note: parsed.data.note || null,
    },
  });
  await db.adminAuditLog.create({ data: { actorUserId: session.id, action: `XGROUP_ALLOCATION_${parsed.data.status}`, entityType: "BusinessAllocation", entityId: allocation.id, before: { status: before.status, bankReference: before.bankReference }, after: { status: allocation.status, bankReference: allocation.bankReference, eventCode: before.attribution.officeEvent.eventCode } } });
  return NextResponse.json({ allocation });
}

