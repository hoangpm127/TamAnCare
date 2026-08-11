import "server-only";

import { addMinutes } from "date-fns";
import { therapistWorksDuring } from "@/lib/server/therapist-schedule";
import { activeBedWhere } from "@/lib/server/facility-operations";
import type { Prisma } from "@/app/generated/prisma/client";

export const BOOKING_AUTO_CONFIRM_KEY = "booking.auto_confirm";

const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;

type BookingAutomationClient = Pick<
  Prisma.TransactionClient,
  "booking" | "bookingGroup" | "branch" | "room" | "systemSetting" | "therapist"
>;

export type BookingAutomationMode = {
  enabled: boolean;
  source: "BRANCH" | "GLOBAL" | "DEFAULT";
};

export type BookingAutomationResult = BookingAutomationMode & {
  changed: boolean;
  confirmed: boolean;
  reason?: "WAITING_PAYMENT" | "ALREADY_PROCESSED" | "NO_RESOURCE";
  referenceCode?: string;
  branchId?: string;
  assignments: Array<{
    bookingCode: string;
    serviceName: string;
    therapistName: string;
    roomName: string;
  }>;
};

export async function resolveBookingAutomationMode(
  client: Pick<Prisma.TransactionClient, "systemSetting">,
  branchId: string,
): Promise<BookingAutomationMode> {
  const settings = await client.systemSetting.findMany({
    where: {
      scopeKey: { in: [`${branchId}:${BOOKING_AUTO_CONFIRM_KEY}`, `GLOBAL:${BOOKING_AUTO_CONFIRM_KEY}`] },
      isActive: true,
    },
    select: { branchId: true, value: true },
  });
  const branchSetting = settings.find((item) => item.branchId === branchId);
  if (branchSetting) return { enabled: branchSetting.value === "true", source: "BRANCH" };
  const globalSetting = settings.find((item) => item.branchId === null);
  if (globalSetting) return { enabled: globalSetting.value === "true", source: "GLOBAL" };
  return { enabled: true, source: "DEFAULT" };
}

export async function maybeAutoConfirmBookingGroup(
  client: BookingAutomationClient,
  bookingGroupId: string,
): Promise<BookingAutomationResult> {
  const group = await client.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    include: {
      branch: true,
      bookings: {
        include: { room: true, service: true, therapist: true },
        orderBy: { startTime: "asc" },
      },
    },
  });
  if (!group) {
    return { enabled: true, source: "DEFAULT", changed: false, confirmed: false, reason: "ALREADY_PROCESSED", assignments: [] };
  }

  const mode = await resolveBookingAutomationMode(client, group.branchId);
  const currentAssignments = group.bookings.map((booking) => ({
    bookingCode: booking.bookingCode,
    serviceName: booking.service.name,
    therapistName: booking.therapist?.fullName ?? "Chưa phân công KTV",
    roomName: booking.room?.name ?? "Chưa xếp giường/phòng",
  }));
  if (!mode.enabled) return { ...mode, changed: false, confirmed: false, referenceCode: group.referenceCode, branchId: group.branchId, assignments: currentAssignments };
  if (group.status !== "PENDING") {
    return {
      ...mode,
      changed: false,
      confirmed: group.status === "CONFIRMED",
      reason: "ALREADY_PROCESSED",
      referenceCode: group.referenceCode,
      branchId: group.branchId,
      assignments: currentAssignments,
    };
  }
  if (group.depositAmount > 0 && !["DEPOSITED", "PAID"].includes(group.paymentStatus)) {
    return { ...mode, changed: false, confirmed: false, reason: "WAITING_PAYMENT", referenceCode: group.referenceCode, branchId: group.branchId, assignments: currentAssignments };
  }

  const assignments: BookingAutomationResult["assignments"] = [];
  for (const booking of group.bookings) {
    let therapist = booking.therapist;
    let room = booking.room;
    if (!therapist || !room) {
      const conflicts = await client.booking.findMany({
        where: {
          id: { not: booking.id },
          branchId: group.branchId,
          status: { in: [...BLOCKING_STATUSES] },
          startTime: { lt: addMinutes(booking.endTime, group.branch.bufferMinutes) },
          endTime: { gt: addMinutes(booking.startTime, -group.branch.bufferMinutes) },
        },
        select: { roomId: true, therapistId: true },
      });
      const busyTherapistIds = new Set(conflicts.map((item) => item.therapistId).filter((id): id is string => Boolean(id)));
      const busyRoomIds = new Set(conflicts.map((item) => item.roomId).filter((id): id is string => Boolean(id)));

      if (!therapist) {
        const candidates = await client.therapist.findMany({
          where: {
            branchId: group.branchId,
            status: "ACTIVE",
            onlineBooking: true,
            services: { some: { id: booking.serviceId } },
          },
          orderBy: [{ servedCount: "asc" }, { ratingAvg: "desc" }, { fullName: "asc" }],
          include: {
            weeklySchedules: {
              where: { isActive: true },
              select: { weekday: true, startMinute: true, endMinute: true, isActive: true },
            },
          },
        });
        therapist = candidates.find((candidate) =>
          therapistWorksDuring(candidate.weeklySchedules, booking.startTime, booking.endTime)
          && !busyTherapistIds.has(candidate.id),
        ) ?? null;
      }
      if (!room) {
        const candidates = await client.room.findMany({
          where: {
            branchId: group.branchId,
            AND: [activeBedWhere()],
            suitableCategories: { has: booking.service.category },
          },
          orderBy: { name: "asc" },
        });
        room = candidates.find((candidate) => !busyRoomIds.has(candidate.id)) ?? null;
      }
      if (!therapist || !room) {
        return {
          ...mode,
          changed: false,
          confirmed: false,
          reason: "NO_RESOURCE",
          referenceCode: group.referenceCode,
          branchId: group.branchId,
          assignments,
        };
      }
      await client.booking.update({
        where: { id: booking.id },
        data: { therapistId: therapist.id, roomId: room.id },
      });
    }
    assignments.push({
      bookingCode: booking.bookingCode,
      serviceName: booking.service.name,
      therapistName: therapist.fullName,
      roomName: room.name,
    });
  }

  await client.booking.updateMany({
    where: { groupId: group.id, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });
  await client.bookingGroup.update({
    where: { id: group.id },
    data: { status: "CONFIRMED", holdExpiresAt: null },
  });

  return {
    ...mode,
    changed: true,
    confirmed: true,
    referenceCode: group.referenceCode,
    branchId: group.branchId,
    assignments,
  };
}
