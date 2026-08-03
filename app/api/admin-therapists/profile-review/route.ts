import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const reviewSchema = z.object({
  therapistId: z.string().min(1),
  decision: z.enum(["APPROVE", "REQUEST_CHANGES"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được duyệt hồ sơ KTV." }, { status: 403 });
  }
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nội dung duyệt hồ sơ chưa hợp lệ." }, { status: 400 });
  if (parsed.data.decision === "REQUEST_CHANGES" && !parsed.data.note) {
    return NextResponse.json({ error: "Vui lòng ghi rõ nội dung KTV cần chỉnh sửa." }, { status: 400 });
  }

  const therapist = await db.therapist.findUnique({ where: { id: parsed.data.therapistId } });
  if (!therapist || therapist.profileApprovalStatus !== "PENDING") {
    return NextResponse.json({ error: "Hồ sơ không còn ở trạng thái chờ duyệt." }, { status: 409 });
  }
  if (session.role !== "OWNER" && session.branchId !== therapist.branchId) {
    return NextResponse.json({ error: "Bạn không có quyền duyệt KTV ngoài cơ sở phụ trách." }, { status: 403 });
  }

  const approved = parsed.data.decision === "APPROVE";
  await db.$transaction(async (tx) => {
    await tx.therapist.update({
      where: { id: therapist.id },
      data: approved ? {
        avatarUrl: therapist.proposedAvatarUrl ?? therapist.avatarUrl,
        publicBio: therapist.proposedBio,
        publicStrengths: therapist.proposedStrengths,
        profileApprovalStatus: "APPROVED",
        profileReviewedAt: new Date(),
        profileReviewNote: parsed.data.note || "Hồ sơ đạt tiêu chuẩn công khai của Tâm An Care.",
      } : {
        profileApprovalStatus: "CHANGES_REQUESTED",
        profileReviewedAt: new Date(),
        profileReviewNote: parsed.data.note,
      },
    });
    await notifyTherapist(tx, {
      therapistName: therapist.fullName,
      branchId: therapist.branchId,
      type: "SYSTEM",
      title: approved ? "Hồ sơ KTV đã được duyệt" : "Hồ sơ KTV cần bổ sung",
      body: approved
        ? "Ảnh, giới thiệu và điểm mạnh đã được công khai để khách hàng xem và lựa chọn."
        : parsed.data.note!,
      actionUrl: "/therapist/me",
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: therapist.branchId,
        action: approved ? "THERAPIST_PROFILE_APPROVED" : "THERAPIST_PROFILE_CHANGES_REQUESTED",
        entityType: "Therapist",
        entityId: therapist.id,
        before: { status: therapist.profileApprovalStatus },
        after: { status: approved ? "APPROVED" : "CHANGES_REQUESTED", note: parsed.data.note ?? null },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
  });

  return NextResponse.json({ saved: true, approvalStatus: approved ? "APPROVED" : "CHANGES_REQUESTED" });
}
