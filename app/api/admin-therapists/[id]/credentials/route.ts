import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";
import {
  ensureTherapistLoginAvailable,
  provisionTherapistAccount,
  TherapistAccountConflict,
} from "@/lib/server/therapist-account";
import { therapistCredentialMutationSchema } from "@/lib/therapist-admin";

function canManage(role: string) {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canManage(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa tài khoản KTV." }, { status: 403 });
  }
  const { id } = await params;
  const current = await db.therapist.findFirst({
    where: { id, ...(session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" }) },
    include: {
      users: { where: { role: "THERAPIST" }, select: { id: true, username: true, isActive: true, passwordChangedAt: true } },
    },
  });
  if (!current) {
    return NextResponse.json({ error: "Không tìm thấy KTV trong phạm vi phụ trách." }, { status: 404 });
  }
  const parsed = therapistCredentialMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin đăng nhập chưa hợp lệ." }, { status: 400 });
  }
  const input = parsed.data;
  try {
    await ensureTherapistLoginAvailable(db, input.phone, id);
  } catch (error) {
    if (error instanceof TherapistAccountConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const result = await db.$transaction(async (tx) => {
    const therapist = await tx.therapist.update({ where: { id }, data: { phone: input.phone } });
    const provisioned = await provisionTherapistAccount(tx, {
      therapistId: therapist.id,
      fullName: therapist.fullName,
      phone: input.phone,
      branchId: therapist.branchId,
      isActive: therapist.status === "ACTIVE",
      password: input.password,
      resetPasswordToPhone: input.resetPasswordToPhone || (!current.users.length && !input.password),
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: therapist.branchId,
        action: current.users.length ? "THERAPIST_CREDENTIALS_UPDATE" : "THERAPIST_ACCOUNT_CREATE",
        entityType: "User",
        entityId: provisioned.account.id,
        before: current.users[0] ? {
          username: current.users[0].username,
          isActive: current.users[0].isActive,
          passwordChangedAt: current.users[0].passwordChangedAt,
        } : undefined,
        after: {
          therapistId: therapist.id,
          username: provisioned.account.username,
          role: "THERAPIST",
          isActive: provisioned.account.isActive,
          passwordReset: Boolean(provisioned.temporaryPassword),
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return provisioned;
  });

  return NextResponse.json({
    persisted: true,
    account: result.account,
    temporaryPassword: result.temporaryPassword,
  });
}
