import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendanceMutationSchema } from "@/lib/facility-admin";
import { getAdminSession } from "@/lib/server/admin-session";
import { attendanceCheckInSnapshot, vietnamWorkDate } from "@/lib/server/facility-operations";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền điểm danh KTV." }, { status: 403 });
  }
  const parsed = attendanceMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thao tác điểm danh chưa hợp lệ." }, { status: 400 });
  if (parsed.data.action === "RESET" && !["OWNER", "BRANCH_MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được xóa điểm danh trong ngày." }, { status: 403 });
  }

  const therapist = await db.therapist.findUnique({
    where: { id: parsed.data.therapistId },
    include: { weeklySchedules: { where: { isActive: true } } },
  });
  if (!therapist) return NextResponse.json({ error: "Không tìm thấy KTV." }, { status: 404 });
  if (session.role !== "OWNER" && session.branchId !== therapist.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được điểm danh KTV tại cơ sở phụ trách." }, { status: 403 });
  }

  if (["CHECK_OUT", "MARK_ABSENT", "MARK_LEAVE", "MARK_OFF"].includes(parsed.data.action)) {
    const activeService = await db.booking.findFirst({
      where: { therapistId: therapist.id, status: "IN_SERVICE" },
      select: { bookingCode: true },
    });
    if (activeService) {
      return NextResponse.json({ error: `KTV vẫn đang phục vụ booking ${activeService.bookingCode}; hãy hoàn tất ca trước.` }, { status: 409 });
    }
  }

  const now = new Date();
  const workDate = vietnamWorkDate(now);
  const current = await db.therapistAttendance.findUnique({
    where: { therapistId_workDate: { therapistId: therapist.id, workDate } },
  });
  if (parsed.data.action === "CHECK_OUT" && !current?.checkInAt) {
    return NextResponse.json({ error: "KTV chưa được ghi nhận vào ca hôm nay." }, { status: 409 });
  }

  const attendance = await db.$transaction(async (tx) => {
    if (parsed.data.action === "RESET") {
      if (current) await tx.therapistAttendance.delete({ where: { id: current.id } });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          branchId: therapist.branchId,
          action: "THERAPIST_ATTENDANCE_RESET",
          entityType: "TherapistAttendance",
          entityId: current?.id ?? therapist.id,
          before: current ?? undefined,
          after: { reset: true, therapistId: therapist.id, workDate: workDate.toISOString() },
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return null;
    }

    let data;
    if (parsed.data.action === "CHECK_IN") {
      const snapshot = attendanceCheckInSnapshot(therapist.weeklySchedules, now);
      const returningToShift = Boolean(current?.checkInAt && current.checkOutAt);
      const checkInNote = returningToShift
        ? "Lễ tân ghi nhận KTV trở lại ca."
        : current && ["ABSENT", "LEAVE", "OFF"].includes(current.status)
          ? `Lễ tân chuyển từ ${current.status} sang có mặt.`
          : current?.note;
      data = {
        status: returningToShift ? current!.status : snapshot.status,
        scheduledStartMinute: returningToShift ? current!.scheduledStartMinute : snapshot.scheduledStartMinute,
        scheduledEndMinute: returningToShift ? current!.scheduledEndMinute : snapshot.scheduledEndMinute,
        lateMinutes: returningToShift ? current!.lateMinutes : snapshot.lateMinutes,
        checkInAt: current?.checkInAt ?? now,
        checkOutAt: null,
        note: parsed.data.note || checkInNote || null,
        recordedByUserId: session.id,
      };
    } else if (parsed.data.action === "CHECK_OUT") {
      data = {
        checkOutAt: now,
        note: parsed.data.note || current?.note || null,
        recordedByUserId: session.id,
      };
    } else {
      const status = parsed.data.action === "MARK_ABSENT"
        ? "ABSENT" as const
        : parsed.data.action === "MARK_LEAVE"
          ? "LEAVE" as const
          : "OFF" as const;
      data = {
        status,
        checkInAt: null,
        checkOutAt: null,
        lateMinutes: 0,
        note: parsed.data.note || null,
        recordedByUserId: session.id,
      };
    }

    const result = await tx.therapistAttendance.upsert({
      where: { therapistId_workDate: { therapistId: therapist.id, workDate } },
      create: { therapistId: therapist.id, branchId: therapist.branchId, workDate, ...data },
      update: data,
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: therapist.branchId,
        action: `THERAPIST_ATTENDANCE_${parsed.data.action}`,
        entityType: "TherapistAttendance",
        entityId: result.id,
        before: current ?? undefined,
        after: result,
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return result;
  });

  return NextResponse.json({ attendance });
}
