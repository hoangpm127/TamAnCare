import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
export {
  attendanceCheckInSnapshot,
  vietnamMinuteOfDay,
  vietnamWeekday,
  vietnamWorkDate,
} from "@/lib/attendance-policy";

type CapacityClient = Pick<Prisma.TransactionClient, "branch" | "room">;

export function activeBedWhere(): Prisma.RoomWhereInput {
  return {
    status: "ACTIVE",
    OR: [
      { facilityRoomId: null },
      { facilityRoom: { status: "ACTIVE", floor: { status: "ACTIVE" } } },
    ],
  };
}

export async function syncBranchSeatCapacity(client: CapacityClient, branchId: string) {
  const seatCapacity = await client.room.count({
    where: { branchId, AND: [activeBedWhere()] },
  });
  await client.branch.update({ where: { id: branchId }, data: { seatCapacity } });
  return seatCapacity;
}
