import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilityStructureDeleteSchema, facilityStructureMutationSchema } from "@/lib/facility-admin";
import { getAdminSession } from "@/lib/server/admin-session";
import { syncBranchSeatCapacity } from "@/lib/server/facility-operations";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

type Session = NonNullable<Awaited<ReturnType<typeof getAdminSession>>>;

function canConfigure(session: Session) {
  return !session.mustChangePassword && ["OWNER", "BRANCH_MANAGER"].includes(session.role);
}

function inBranchScope(session: Session, branchId: string) {
  return session.role === "OWNER" || session.branchId === branchId;
}

function note(value: string) {
  return value || null;
}

function mutationError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2002") return NextResponse.json({ error: "Tên này đã tồn tại trong cùng khu vực." }, { status: 409 });
  if (code === "P2003") return NextResponse.json({ error: "Không thể xóa vì dữ liệu vẫn đang được sử dụng." }, { status: 409 });
  console.error("facility.structure_mutation_failed", error);
  return NextResponse.json({ error: "Không thể cập nhật sơ đồ cơ sở." }, { status: 503 });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || !canConfigure(session)) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được thay đổi mặt bằng." }, { status: 403 });
  const parsed = facilityStructureMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin tầng, phòng hoặc giường chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.entity === "FLOOR") {
        const input = parsed.data.data;
        if (!inBranchScope(session, input.branchId)) throw new Error("SCOPE");
        const branch = await tx.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
        if (!branch) throw new Error("BRANCH_NOT_FOUND");
        const created = await tx.facilityFloor.create({ data: { ...input, note: note(input.note) } });
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: input.branchId, action: "FACILITY_FLOOR_CREATE", entityType: "FacilityFloor", entityId: created.id, after: created, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, item: created };
      }

      if (parsed.data.entity === "ROOM") {
        const input = parsed.data.data;
        const floor = await tx.facilityFloor.findUnique({ where: { id: input.floorId }, select: { branchId: true } });
        if (!floor) throw new Error("FLOOR_NOT_FOUND");
        if (!inBranchScope(session, floor.branchId)) throw new Error("SCOPE");
        const created = await tx.facilityRoom.create({ data: { ...input, note: note(input.note) } });
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: floor.branchId, action: "FACILITY_ROOM_CREATE", entityType: "FacilityRoom", entityId: created.id, after: created, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, item: created };
      }

      const input = parsed.data.data;
      const target = await tx.facilityRoom.findUnique({ where: { id: input.facilityRoomId }, include: { floor: { select: { branchId: true } } } });
      if (!target) throw new Error("ROOM_NOT_FOUND");
      if (!inBranchScope(session, target.floor.branchId)) throw new Error("SCOPE");
      const created = await tx.room.create({ data: { ...input, branchId: target.floor.branchId, note: note(input.note) } });
      const seatCapacity = await syncBranchSeatCapacity(tx, target.floor.branchId);
      await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: target.floor.branchId, action: "FACILITY_BED_CREATE", entityType: "Room", entityId: created.id, after: { ...created, seatCapacity }, ipHash: privateIdentifierDigest(requestIp(request)) } });
      return { entity: parsed.data.entity, item: created, seatCapacity };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SCOPE") return NextResponse.json({ error: "Bạn chỉ được cấu hình cơ sở phụ trách." }, { status: 403 });
    if (error instanceof Error && error.message.endsWith("_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy cấp mặt bằng đã chọn." }, { status: 404 });
    return mutationError(error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || !canConfigure(session)) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được thay đổi mặt bằng." }, { status: 403 });
  const parsed = facilityStructureMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.entity === "FLOOR") {
        const current = await tx.facilityFloor.findUnique({ where: { id: parsed.data.id } });
        if (!current) throw new Error("FLOOR_NOT_FOUND");
        if (!inBranchScope(session, current.branchId) || parsed.data.data.branchId !== current.branchId) throw new Error("SCOPE");
        const updated = await tx.facilityFloor.update({ where: { id: current.id }, data: { ...parsed.data.data, note: note(parsed.data.data.note) } });
        const seatCapacity = await syncBranchSeatCapacity(tx, current.branchId);
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.branchId, action: "FACILITY_FLOOR_UPDATE", entityType: "FacilityFloor", entityId: current.id, before: current, after: { ...updated, seatCapacity }, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, item: updated, seatCapacity };
      }

      if (parsed.data.entity === "ROOM") {
        const current = await tx.facilityRoom.findUnique({ where: { id: parsed.data.id }, include: { floor: { select: { branchId: true } } } });
        const targetFloor = await tx.facilityFloor.findUnique({ where: { id: parsed.data.data.floorId }, select: { branchId: true } });
        if (!current || !targetFloor) throw new Error("ROOM_NOT_FOUND");
        if (!inBranchScope(session, current.floor.branchId) || targetFloor.branchId !== current.floor.branchId) throw new Error("SCOPE");
        const updated = await tx.facilityRoom.update({ where: { id: current.id }, data: { ...parsed.data.data, note: note(parsed.data.data.note) } });
        const seatCapacity = await syncBranchSeatCapacity(tx, current.floor.branchId);
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.floor.branchId, action: "FACILITY_ROOM_UPDATE", entityType: "FacilityRoom", entityId: current.id, before: current, after: { ...updated, seatCapacity }, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, item: updated, seatCapacity };
      }

      const current = await tx.room.findUnique({ where: { id: parsed.data.id } });
      const target = await tx.facilityRoom.findUnique({ where: { id: parsed.data.data.facilityRoomId }, include: { floor: { select: { branchId: true } } } });
      if (!current || !target) throw new Error("BED_NOT_FOUND");
      if (!inBranchScope(session, current.branchId) || target.floor.branchId !== current.branchId) throw new Error("SCOPE");
      const updated = await tx.room.update({ where: { id: current.id }, data: { ...parsed.data.data, note: note(parsed.data.data.note) } });
      const seatCapacity = await syncBranchSeatCapacity(tx, current.branchId);
      await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.branchId, action: "FACILITY_BED_UPDATE", entityType: "Room", entityId: current.id, before: current, after: { ...updated, seatCapacity }, ipHash: privateIdentifierDigest(requestIp(request)) } });
      return { entity: parsed.data.entity, item: updated, seatCapacity };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SCOPE") return NextResponse.json({ error: "Không được chuyển tài nguyên sang cơ sở khác." }, { status: 403 });
    if (error instanceof Error && error.message.endsWith("_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy dữ liệu cần sửa." }, { status: 404 });
    return mutationError(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || !canConfigure(session)) return NextResponse.json({ error: "Chỉ Admin hoặc Quản lý cơ sở được thay đổi mặt bằng." }, { status: 403 });
  const parsed = facilityStructureDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu xóa chưa hợp lệ." }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.entity === "FLOOR") {
        const current = await tx.facilityFloor.findUnique({ where: { id: parsed.data.id }, include: { _count: { select: { rooms: true } } } });
        if (!current) throw new Error("FLOOR_NOT_FOUND");
        if (!inBranchScope(session, current.branchId)) throw new Error("SCOPE");
        if (current._count.rooms > 0) throw new Error("FLOOR_HAS_CHILDREN");
        await tx.facilityFloor.delete({ where: { id: current.id } });
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.branchId, action: "FACILITY_FLOOR_DELETE", entityType: "FacilityFloor", entityId: current.id, before: current, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, mode: "HARD_DELETE" };
      }

      if (parsed.data.entity === "ROOM") {
        const current = await tx.facilityRoom.findUnique({ where: { id: parsed.data.id }, include: { floor: { select: { branchId: true } }, _count: { select: { beds: true } } } });
        if (!current) throw new Error("ROOM_NOT_FOUND");
        if (!inBranchScope(session, current.floor.branchId)) throw new Error("SCOPE");
        if (current._count.beds > 0) throw new Error("ROOM_HAS_CHILDREN");
        await tx.facilityRoom.delete({ where: { id: current.id } });
        await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.floor.branchId, action: "FACILITY_ROOM_DELETE", entityType: "FacilityRoom", entityId: current.id, before: current, ipHash: privateIdentifierDigest(requestIp(request)) } });
        return { entity: parsed.data.entity, mode: "HARD_DELETE" };
      }

      const current = await tx.room.findUnique({ where: { id: parsed.data.id }, include: { _count: { select: { bookings: true } } } });
      if (!current) throw new Error("BED_NOT_FOUND");
      if (!inBranchScope(session, current.branchId)) throw new Error("SCOPE");
      const mode = current._count.bookings > 0 ? "SOFT_DELETE" as const : "HARD_DELETE" as const;
      const after = mode === "SOFT_DELETE"
        ? await tx.room.update({ where: { id: current.id }, data: { status: "HIDDEN" } })
        : (await tx.room.delete({ where: { id: current.id } }), null);
      const seatCapacity = await syncBranchSeatCapacity(tx, current.branchId);
      await tx.adminAuditLog.create({ data: { actorUserId: session.id, branchId: current.branchId, action: mode === "SOFT_DELETE" ? "FACILITY_BED_ARCHIVE" : "FACILITY_BED_DELETE", entityType: "Room", entityId: current.id, before: current, after: after ? { ...after, seatCapacity } : { deleted: true, seatCapacity }, ipHash: privateIdentifierDigest(requestIp(request)) } });
      return { entity: parsed.data.entity, mode, seatCapacity };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SCOPE") return NextResponse.json({ error: "Bạn chỉ được cấu hình cơ sở phụ trách." }, { status: 403 });
    if (error instanceof Error && error.message === "FLOOR_HAS_CHILDREN") return NextResponse.json({ error: "Tầng vẫn còn phòng. Hãy chuyển hoặc ngừng các phòng trước khi xóa tầng." }, { status: 409 });
    if (error instanceof Error && error.message === "ROOM_HAS_CHILDREN") return NextResponse.json({ error: "Phòng vẫn còn giường/ghế. Hãy chuyển hoặc ngừng các vị trí trước khi xóa phòng." }, { status: 409 });
    if (error instanceof Error && error.message.endsWith("_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy dữ liệu cần xóa." }, { status: 404 });
    return mutationError(error);
  }
}
