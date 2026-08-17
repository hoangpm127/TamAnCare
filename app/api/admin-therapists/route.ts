import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { privateIdentifierDigest, isSameOriginMutation, requestIp } from "@/lib/server/request-security";
import {
  ensureTherapistLoginAvailable,
  provisionTherapistAccount,
  TherapistAccountConflict,
} from "@/lib/server/therapist-account";
import { scheduleShiftLabel, therapistMutationSchema } from "@/lib/therapist-admin";

function canManage(role: string) {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canManage(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền thêm KTV." }, { status: 403 });
  }
  const parsed = therapistMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin KTV chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (session.role !== "OWNER" && input.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được thêm KTV tại cơ sở phụ trách." }, { status: 403 });
  }

  const [branch, serviceCount] = await Promise.all([
    db.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }),
    db.service.count({ where: { id: { in: input.serviceIds }, isActive: true } }),
  ]);
  if (!branch || serviceCount !== new Set(input.serviceIds).size) {
    return NextResponse.json({ error: "Cơ sở hoặc dịch vụ đã chọn không còn hợp lệ." }, { status: 400 });
  }
  try {
    await ensureTherapistLoginAvailable(db, input.phone);
  } catch (error) {
    if (error instanceof TherapistAccountConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const result = await db.$transaction(async (tx) => {
    const created = await tx.therapist.create({
      data: {
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone,
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
        services: { connect: [...new Set(input.serviceIds)].map((id) => ({ id })) },
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
    const provisioned = await provisionTherapistAccount(tx, {
      therapistId: created.id,
      fullName: created.fullName,
      phone: input.phone,
      branchId: created.branchId,
      isActive: created.status === "ACTIVE",
      resetPasswordToPhone: true,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: created.branchId,
        action: "THERAPIST_CREATE",
        entityType: "Therapist",
        entityId: created.id,
        after: created,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: created.branchId,
        action: "THERAPIST_ACCOUNT_CREATE",
        entityType: "User",
        entityId: provisioned.account.id,
        after: {
          therapistId: created.id,
          username: provisioned.account.username,
          role: "THERAPIST",
          isActive: provisioned.account.isActive,
          temporaryPasswordIssued: true,
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return { therapist: created, provisioned };
  });
  revalidateTag("public-catalog", { expire: 0 });
  return NextResponse.json({
    therapist: result.therapist,
    credentials: {
      username: result.provisioned.account.username,
      temporaryPassword: result.provisioned.temporaryPassword,
      mustChangePassword: true,
    },
  }, { status: 201 });
}
