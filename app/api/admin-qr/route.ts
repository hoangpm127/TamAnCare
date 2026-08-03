import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({ targetType: z.enum(["BRANCH", "THERAPIST", "BUSINESS"]), targetId: z.string().trim().min(1) });

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được quản lý QR." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Đối tượng QR chưa hợp lệ." }, { status: 400 });
  const { targetType, targetId } = parsed.data;

  const result = await db.$transaction(async (tx) => {
    let branchId: string;
    let label: string;
    let therapistName: string | null = null;
    let customerId: string | null = null;

    if (targetType === "BRANCH") {
      const branch = await tx.branch.findUnique({ where: { id: targetId } });
      if (!branch) throw new Error("NOT_FOUND");
      branchId = branch.id;
      label = branch.name.replace(/^Tâm An Center · /, "");
      await tx.branch.update({ where: { id: branch.id }, data: { qrVersion: { increment: 1 } } });
    } else if (targetType === "THERAPIST") {
      const therapist = await tx.therapist.findUnique({ where: { id: targetId } });
      if (!therapist) throw new Error("NOT_FOUND");
      branchId = therapist.branchId;
      label = therapist.fullName;
      therapistName = therapist.fullName;
      await tx.therapist.update({ where: { id: therapist.id }, data: { qrVersion: { increment: 1 } } });
    } else {
      const event = await tx.officeEvent.findUnique({ where: { id: targetId }, include: { leadTherapist: true } });
      if (!event) throw new Error("NOT_FOUND");
      branchId = event.branchId;
      label = `${event.companyName} · ${event.eventCode}`;
      therapistName = event.leadTherapist?.fullName ?? null;
      customerId = event.customerId;
      await tx.officeEvent.update({ where: { id: event.id }, data: { qrVersion: { increment: 1 } } });
    }

    if (session.role !== "OWNER" && session.branchId !== branchId) throw new Error("FORBIDDEN");
    await notifyOperations(tx, {
      branchId,
      audience: "MANAGEMENT",
      type: "SYSTEM",
      title: `Đã cấp lại QR · ${label}`,
      body: "Mã cũ đã hết hiệu lực. Hãy tải hoặc gửi mã mới từ Trung tâm quản lý QR.",
      actionUrl: "/admin/qr-management",
    });
    if (therapistName) await notifyTherapist(tx, { therapistName, branchId, type: "SYSTEM", title: "QR phục vụ đã được cấp lại", body: "Mã cũ đã hết hiệu lực. Mở QR mới trên Topbar KTV trước khi phục vụ khách.", actionUrl: "/therapist" });
    if (customerId && targetType === "BUSINESS") await notifyCustomer(tx, customerId, { branchId, type: "BOOKING", title: "QR Business đã được cập nhật", body: "Khi triển khai, vui lòng quét mã mới trên điện thoại KTV Business trưởng.", actionUrl: "/doanh-nghiep" });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId,
        action: `QR_REISSUED_${targetType}`,
        entityType: targetType,
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
