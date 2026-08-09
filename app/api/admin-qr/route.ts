import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({ targetType: z.literal("BUSINESS"), targetId: z.string().trim().min(1) });

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được quản lý QR." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Đối tượng QR chưa hợp lệ." }, { status: 400 });
  const { targetId } = parsed.data;

  const result = await db.$transaction(async (tx) => {
    const event = await tx.officeEvent.findUnique({ where: { id: targetId } });
    if (!event) throw new Error("NOT_FOUND");
    const branchId = event.branchId;
    const label = `${event.companyName} · ${event.eventCode}`;

    if (session.role !== "OWNER" && session.branchId !== branchId) throw new Error("FORBIDDEN");
    await tx.officeEvent.update({ where: { id: event.id }, data: { qrVersion: { increment: 1 } } });
    await notifyOperations(tx, {
      branchId,
      audience: "MANAGEMENT",
      type: "SYSTEM",
      title: `Đã cấp lại QR Tâm An Business · ${label}`,
      body: "Mã Business cũ đã hết hiệu lực. Hãy tải hoặc gửi mã mới cho chương trình tại doanh nghiệp.",
      actionUrl: "/admin/qr-management",
    });
    if (event.customerId) await notifyCustomer(tx, event.customerId, { branchId, type: "BOOKING", title: "QR Business đã được cập nhật", body: "Khi triển khai, vui lòng quét mã mới trên điện thoại KTV Business trưởng.", actionUrl: "/doanh-nghiep" });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId,
        action: "QR_REISSUED_BUSINESS",
        entityType: "BUSINESS",
        entityId: targetId,
        before: { active: true },
        after: { previousQrInvalidated: true },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return { branchId, label };
  }).catch((error: unknown) => {
    if (error instanceof Error && ["NOT_FOUND", "FORBIDDEN"].includes(error.message)) return { error: error.message } as const;
    throw error;
  });

  if ("error" in result) return NextResponse.json({ error: result.error === "FORBIDDEN" ? "QR nằm ngoài cơ sở bạn phụ trách." : "Không tìm thấy QR cần cấp lại." }, { status: result.error === "FORBIDDEN" ? 403 : 404 });
  return NextResponse.json({ saved: true, message: `Đã cấp lại QR ${result.label}.` });
}
