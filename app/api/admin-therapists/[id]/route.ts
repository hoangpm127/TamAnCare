import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { privateIdentifierDigest, isSameOriginMutation, requestIp } from "@/lib/server/request-security";
import { scheduleShiftLabel, therapistMutationSchema } from "@/lib/therapist-admin";

function canManage(role: string) {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

async function scopedTherapist(id: string, session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>) {
  return db.therapist.findFirst({
    where: { id, ...(session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" }) },
    include: { weeklySchedules: true, services: { select: { id: true } } },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canManage(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa KTV." }, { status: 403 });
  }
  const { id } = await params;
  const current = await scopedTherapist(id, session);
  if (!current) return NextResponse.json({ error: "Không tìm thấy KTV trong phạm vi phụ trách." }, { status: 404 });
  const parsed = therapistMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin KTV chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (session.role !== "OWNER" && input.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn không được chuyển KTV sang cơ sở khác." }, { status: 403 });
  }
  const [branch, serviceCount] = await Promise.all([
    db.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }),
    db.service.count({ where: { id: { in: input.serviceIds }, isActive: true } }),
  ]);
  if (!branch || serviceCount !== new Set(input.serviceIds).size) {
    return NextResponse.json({ error: "Cơ sở hoặc dịch vụ đã chọn không còn hợp lệ." }, { status: 400 });
  }

  const therapist = await db.$transaction(async (tx) => {
    await tx.therapistWeeklySchedule.deleteMany({ where: { therapistId: id } });
    const updated = await tx.therapist.update({
      where: { id },
      data: {
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone || null,
        avatarUrl: input.avatarUrl || null,
        publicBio: input.publicBio || null,
        publicStrengths: input.publicStrengths,
        profileApprovalStatus: "APPROVED",
        profileReviewedAt: new Date(),
        gender: input.gender || null,
        skills: input.skills,
        shiftLabel: scheduleShiftLabel(input.schedules),
        status: input.status,
        onlineBooking: input.onlineBooking,
        internalNote: input.internalNote || null,
        services: { set: [...new Set(input.serviceIds)].map((serviceId) => ({ id: serviceId })) },
        weeklySchedules: {
          create: input.schedules.map((schedule) => ({
            weekday: schedule.weekday,
            startMinute: schedule.startMinute,
            endMinute: schedule.endMinute,
            isActive: schedule.isActive,
          })),
        },
      },
      include: { weeklySchedules: true, services: { select: { id: true } } },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: updated.branchId,
        action: "THERAPIST_UPDATE",
        entityType: "Therapist",
        entityId: id,
        before: current,
        after: updated,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return updated;
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ therapist });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canManage(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền ngừng KTV." }, { status: 403 });
  }
  const { id } = await params;
  const current = await scopedTherapist(id, session);
  if (!current) return NextResponse.json({ error: "Không tìm thấy KTV trong phạm vi phụ trách." }, { status: 404 });

  await db.$transaction(async (tx) => {
    const hidden = await tx.therapist.update({ where: { id }, data: { status: "HIDDEN", onlineBooking: false } });
    await tx.user.updateMany({ where: { therapistId: id }, data: { isActive: false } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: current.branchId,
        action: "THERAPIST_DEACTIVATE",
        entityType: "Therapist",
        entityId: id,
        before: current,
        after: hidden,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({ ok: true, mode: "SOFT_DELETE" });
}
