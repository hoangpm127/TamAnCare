import { intervalsOverlapWithBuffer, type ScheduledResourceBooking } from "@/lib/scheduling-policy";

export type AllocationUnit = {
  key: string;
  start: Date;
  end: Date;
  therapistCandidateIds: string[];
  bedCandidateIds: string[];
};

export type AllocationBed = {
  id: string;
  facilityRoomId: string | null;
};

export type ResourceAssignment = {
  unitKey: string;
  therapistId: string;
  bedId: string;
  facilityRoomId: string | null;
};

export type ResourceAllocation = {
  assignments: ResourceAssignment[];
  roomCount: number;
  sameRoom: boolean;
};

type AssignedResource = {
  unit: AllocationUnit;
  resourceId: string;
};

function resourceIsFree(
  resourceId: string,
  unit: AllocationUnit,
  bookings: ScheduledResourceBooking[],
  field: "therapistId" | "roomId",
  bufferMinutes: number,
) {
  return !bookings.some((booking) => booking[field] === resourceId
    && intervalsOverlapWithBuffer(unit.start, unit.end, booking.startTime, booking.endTime, bufferMinutes));
}

function resourceCanBeReused(
  resourceId: string,
  unit: AllocationUnit,
  assigned: AssignedResource[],
  bufferMinutes: number,
) {
  return !assigned.some((item) => item.resourceId === resourceId
    && intervalsOverlapWithBuffer(unit.start, unit.end, item.unit.start, item.unit.end, bufferMinutes));
}

function seatCapacityAllows(
  units: AllocationUnit[],
  bookings: ScheduledResourceBooking[],
  seatCapacity: number,
  bufferMinutes: number,
) {
  if (seatCapacity < 1) return false;
  const bufferMs = bufferMinutes * 60_000;
  const relevantBookings = bookings.filter((booking) => units.some((unit) => intervalsOverlapWithBuffer(
    unit.start,
    unit.end,
    booking.startTime,
    booking.endTime,
    bufferMinutes,
  )));
  const intervals = [
    ...relevantBookings.map((booking) => ({
      start: booking.startTime.getTime(),
      end: booking.endTime.getTime() + bufferMs,
    })),
    ...units.map((unit) => ({
      start: unit.start.getTime(),
      end: unit.end.getTime() + bufferMs,
    })),
  ];
  const points = [...new Set(intervals.map((item) => item.start))];
  return points.every((point) => intervals.filter((item) => item.start <= point && point < item.end).length <= seatCapacity);
}

function assignTherapists(
  units: AllocationUnit[],
  bookings: ScheduledResourceBooking[],
  bufferMinutes: number,
) {
  const candidatesByKey = new Map(units.map((unit) => [
    unit.key,
    unit.therapistCandidateIds.filter((id) => resourceIsFree(id, unit, bookings, "therapistId", bufferMinutes)),
  ]));
  const ordered = [...units].sort((left, right) =>
    (candidatesByKey.get(left.key)?.length ?? 0) - (candidatesByKey.get(right.key)?.length ?? 0));
  const assigned: AssignedResource[] = [];
  const result = new Map<string, string>();

  function visit(index: number): boolean {
    if (index >= ordered.length) return true;
    const unit = ordered[index];
    for (const therapistId of candidatesByKey.get(unit.key) ?? []) {
      if (!resourceCanBeReused(therapistId, unit, assigned, bufferMinutes)) continue;
      assigned.push({ unit, resourceId: therapistId });
      result.set(unit.key, therapistId);
      if (visit(index + 1)) return true;
      result.delete(unit.key);
      assigned.pop();
    }
    return false;
  }

  return visit(0) ? result : null;
}

function bedGroupId(bed: AllocationBed) {
  // Legacy beds without a physical room must never be treated as if they all
  // belonged to one shared room.
  return bed.facilityRoomId ? `room:${bed.facilityRoomId}` : `bed:${bed.id}`;
}

function assignBeds(
  units: AllocationUnit[],
  beds: AllocationBed[],
  bookings: ScheduledResourceBooking[],
  bufferMinutes: number,
): Map<string, AllocationBed> | null {
  const bedById = new Map(beds.map((bed) => [bed.id, bed]));
  const candidatesByKey = new Map(units.map((unit) => [
    unit.key,
    unit.bedCandidateIds
      .map((id) => bedById.get(id))
      .filter((bed): bed is AllocationBed => Boolean(bed))
      .filter((bed) => resourceIsFree(bed.id, unit, bookings, "roomId", bufferMinutes)),
  ]));
  const ordered = [...units].sort((left, right) =>
    (candidatesByKey.get(left.key)?.length ?? 0) - (candidatesByKey.get(right.key)?.length ?? 0));
  const assigned: AssignedResource[] = [];
  const current = new Map<string, AllocationBed>();
  let best: Map<string, AllocationBed> | null = null;
  let bestRoomCount = Number.POSITIVE_INFINITY;

  function visit(index: number, usedGroups: Set<string>) {
    if (usedGroups.size >= bestRoomCount) return;
    if (index >= ordered.length) {
      best = new Map(current);
      bestRoomCount = usedGroups.size;
      return;
    }

    const unit = ordered[index];
    const candidates = [...(candidatesByKey.get(unit.key) ?? [])].sort((left, right) => {
      const leftUsed = usedGroups.has(bedGroupId(left)) ? 0 : 1;
      const rightUsed = usedGroups.has(bedGroupId(right)) ? 0 : 1;
      return leftUsed - rightUsed || left.id.localeCompare(right.id);
    });

    for (const bed of candidates) {
      if (!resourceCanBeReused(bed.id, unit, assigned, bufferMinutes)) continue;
      const groupId = bedGroupId(bed);
      const nextGroups = new Set(usedGroups);
      nextGroups.add(groupId);
      if (nextGroups.size >= bestRoomCount) continue;
      assigned.push({ unit, resourceId: bed.id });
      current.set(unit.key, bed);
      visit(index + 1, nextGroups);
      current.delete(unit.key);
      assigned.pop();
      if (bestRoomCount === 1) return;
    }
  }

  visit(0, new Set());
  return best as Map<string, AllocationBed> | null;
}

/**
 * Finds one resource assignment that is valid for every unit. Therapist and
 * bed conflicts are checked for the complete service duration plus buffer.
 * Bed assignment minimizes the number of physical rooms, so groups stay
 * together whenever a compatible room has enough free beds.
 */
export function allocateBookingResources(input: {
  units: AllocationUnit[];
  beds: AllocationBed[];
  bookings: ScheduledResourceBooking[];
  seatCapacity: number;
  bufferMinutes: number;
}): ResourceAllocation | null {
  if (!input.units.length) return null;
  if (!seatCapacityAllows(input.units, input.bookings, input.seatCapacity, input.bufferMinutes)) return null;

  const therapists = assignTherapists(input.units, input.bookings, input.bufferMinutes);
  if (!therapists) return null;
  const beds = assignBeds(input.units, input.beds, input.bookings, input.bufferMinutes);
  if (!beds) return null;

  const assignments = input.units.map((unit) => {
    const bed = beds.get(unit.key)!;
    return {
      unitKey: unit.key,
      therapistId: therapists.get(unit.key)!,
      bedId: bed.id,
      facilityRoomId: bed.facilityRoomId,
    };
  });
  const roomCount = new Set(assignments.map((item) => item.facilityRoomId ? `room:${item.facilityRoomId}` : `bed:${item.bedId}`)).size;
  return { assignments, roomCount, sameRoom: roomCount === 1 };
}
