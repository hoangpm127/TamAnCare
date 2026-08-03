import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BOOKING_AUTO_CONFIRM_KEY,
  maybeAutoConfirmBookingGroup,
  resolveBookingAutomationMode,
} from "@/lib/server/booking-automation";
import { getAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const updateSchema = z.object({
  branchId: z.string().trim().max(80).nullable().optional(),
  mode: z.enum(["AUTO", "MANUAL"]),
});

function requestedScope(session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>, rawBranchId?: string | null) {
  if (session.role === "OWNER") return rawBranchId && rawBranchId !== "all" ? rawBranchId : null;
  return session.branchId;
}

async function responseForScope(session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>, branchId: string | null) {
  if (branchId) {
    const branch = await db.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } });
    if (!branch) return null;
    const resolved = await resolveBookingAutomationMode(db, branch.id);
    return {
      mode: resolved.enabled ? "AUTO" as const : "MANUAL" as const,
      source: resolved.source,
      branchId: branch.id,
      scopeLabel: branch.name.replace(/^Tâm An Center · /, ""),
      canManage: ["OWNER", "BRANCH_MANAGER"].includes(session.role),
    };
  }
  const globalSetting = await db.systemSetting.findUnique({ where: { scopeKey: `GLOBAL:${BOOKING_AUTO_CONFIRM_KEY}` } });
  const enabled = globalSetting ? globalSetting.isActive && globalSetting.value === "true" : true;
  return {
    mode: enabled ? "AUTO" as const : "MANUAL" as const,
    source: globalSetting ? "GLOBAL" as const : "DEFAULT" as const,
    branchId: null,
    scopeLabel: "Toàn hệ thống",
    canManage: session.role === "OWNER",
  };
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Bạn không có quyền xem cấu hình Booking." }, { status: 403 });
  }
  const url = new URL(request.url);
  const scope = requestedScope(session, url.searchParams.get("branchId"));
  if (session.role !== "OWNER" && !scope) return NextResponse.json({ error: "Tài khoản chưa được gắn cơ sở." }, { status: 409 });
  const result = await responseForScope(session, scope ?? null);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Không tìm thấy cơ sở." }, { status: 404 });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được đổi chế độ xác nhận." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Chế độ xác nhận chưa hợp lệ." }, { status: 400 });
  const branchId = requestedScope(session, parsed.data.branchId);
  if (session.role !== "OWNER" && !branchId) return NextResponse.json({ error: "Tài khoản chưa được gắn cơ sở." }, { status: 409 });
  if (branchId && !(await db.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Không tìm thấy cơ sở." }, { status: 404 });
  }

  const scopeKey = `${branchId ?? "GLOBAL"}:${BOOKING_AUTO_CONFIRM_KEY}`;
  const before = await db.systemSetting.findUnique({ where: { scopeKey } });
  const setting = await db.systemSetting.upsert({
    where: { scopeKey },
    create: {
      key: BOOKING_AUTO_CONFIRM_KEY,
      scopeKey,
      category: "BOOKING",
      label: "AI tự động xác nhận & điều phối",
      value: parsed.data.mode === "AUTO" ? "true" : "false",
      valueType: "BOOLEAN",
      description: "Tự xác nhận lịch sau đối soát cọc, giữ chỗ và điều phối KTV phù hợp; tắt để Admin/Quản lý xác nhận thủ công.",
      branchId,
      isActive: true,
    },
    update: { value: parsed.data.mode === "AUTO" ? "true" : "false", isActive: true },
  });
  await db.adminAuditLog.create({
    data: {
      actorUserId: session.id,
      branchId,
      action: "BOOKING_AUTOMATION_MODE_UPDATE",
      entityType: "SystemSetting",
      entityId: setting.id,
      before: before ?? undefined,
      after: setting,
      ipHash: privateIdentifierDigest(requestIp(request)),
    },
  });

  let automaticallyConfirmed = 0;
  if (parsed.data.mode === "AUTO") {
    const pendingGroups = await db.bookingGroup.findMany({
      where: {
        status: "PENDING",
        paymentStatus: { in: ["DEPOSITED", "PAID"] },
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const group of pendingGroups) {
      try {
        const result = await db.$transaction(
          async (tx) => {
            const confirmation = await maybeAutoConfirmBookingGroup(tx, group.id);
            if (!confirmation.changed) return confirmation;
            const confirmedGroup = await tx.bookingGroup.findUnique({
              where: { id: group.id },
              include: { customer: true },
            });
            if (!confirmedGroup) return confirmation;
            await notifyCustomer(tx, confirmedGroup.customerId, {
              branchId: confirmedGroup.branchId,
              type: "BOOKING",
              title: "Chúc mừng! Lịch đã được AI xác nhận",
              body: `${confirmedGroup.referenceCode} đã được xếp ${confirmation.assignments.map((item) => `${item.therapistName} · ${item.roomName}`).join(", ")}. Mở Đơn của tôi và dùng Camera quét QR tại cơ sở để check-in.`,
              actionUrl: `/booking/success/${confirmedGroup.referenceCode}`,
            });
            await notifyOperations(tx, {
              branchId: confirmedGroup.branchId,
              type: "BOOKING",
              title: `AI vừa xử lý lịch chờ · ${confirmedGroup.customer.fullName}`,
              body: `${confirmedGroup.referenceCode} đã đủ cọc và được tự động xác nhận sau khi bật chế độ AI.`,
              actionUrl: "/admin/bookings",
            });
            for (const assignment of confirmation.assignments) {
              await notifyTherapist(tx, {
                branchId: confirmedGroup.branchId,
                therapistName: assignment.therapistName,
                type: "BOOKING",
                title: `IQ Care vừa điều phối lịch mới · ${confirmedGroup.customer.fullName}`,
                body: `${assignment.serviceName} · ${confirmedGroup.referenceCode} · ${assignment.roomName}. Lịch đã sẵn sàng trong Lịch của tôi.`,
                actionUrl: `/therapist/bookings/${assignment.bookingCode}`,
              });
            }
            return confirmation;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        if (result.changed) automaticallyConfirmed += 1;
      } catch (error) {
        console.error("booking_automation.backlog_confirm_failed", { groupId: group.id, error });
      }
    }
  }

  const result = await responseForScope(session, branchId ?? null);
  return NextResponse.json({ ...result, automaticallyConfirmed });
}
