import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";
import { notifyOperations } from "@/lib/server/notification-service";
import { isSameOriginMutation } from "@/lib/server/request-security";

const avatarSchema = z.string().max(1_400_000).refine(
  (value) => /^data:image\/(png|jpeg|webp);base64,/i.test(value) || /^https:\/\//i.test(value),
  "Ảnh đại diện phải là PNG, JPG, WebP hoặc đường dẫn HTTPS.",
);

const profileSchema = z.object({
  bio: z.string().trim().min(30).max(600),
  strengths: z.array(z.string().trim().min(2).max(50)).min(1).max(6),
  avatarUrl: avatarSchema.optional().nullable(),
});

async function ownTherapist() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role !== "THERAPIST") return null;
  const therapist = await therapistForSession(session);
  return therapist ? { session, therapist } : null;
}

export async function GET() {
  const context = await ownTherapist();
  if (!context) return NextResponse.json({ error: "Không tìm thấy hồ sơ KTV đang đăng nhập." }, { status: 403 });
  const { therapist } = context;
  return NextResponse.json({
    profile: {
      id: therapist.id,
      fullName: therapist.fullName,
      phone: therapist.phone,
      avatarUrl: therapist.avatarUrl,
      publicBio: therapist.publicBio,
      publicStrengths: therapist.publicStrengths,
      proposedAvatarUrl: therapist.proposedAvatarUrl,
      proposedBio: therapist.proposedBio,
      proposedStrengths: therapist.proposedStrengths,
      approvalStatus: therapist.profileApprovalStatus,
      reviewNote: therapist.profileReviewNote,
      submittedAt: therapist.profileSubmittedAt?.toISOString() ?? null,
      reviewedAt: therapist.profileReviewedAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const context = await ownTherapist();
  if (!context) return NextResponse.json({ error: "Không tìm thấy hồ sơ KTV đang đăng nhập." }, { status: 403 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Hồ sơ chưa đầy đủ hoặc ảnh vượt quá dung lượng cho phép." }, { status: 400 });

  const strengths = [...new Set(parsed.data.strengths.map((item) => item.trim()).filter(Boolean))];
  const updated = await db.$transaction(async (tx) => {
    const record = await tx.therapist.update({
      where: { id: context.therapist.id },
      data: {
        proposedAvatarUrl: parsed.data.avatarUrl || context.therapist.avatarUrl,
        proposedBio: parsed.data.bio,
        proposedStrengths: strengths,
        profileApprovalStatus: "PENDING",
        profileSubmittedAt: new Date(),
        profileReviewedAt: null,
        profileReviewNote: null,
      },
    });
    await notifyOperations(tx, {
      branchId: record.branchId,
      audience: "MANAGEMENT",
      type: "SYSTEM",
      title: `KTV gửi hồ sơ chờ duyệt · ${record.fullName}`,
      body: `${strengths.join(" · ")} · Admin kiểm tra ảnh, giới thiệu và điểm mạnh trước khi công khai cho khách.`,
      actionUrl: "/admin/therapists",
    });
    return record;
  });

  return NextResponse.json({ saved: true, approvalStatus: updated.profileApprovalStatus });
}
