import assert from "node:assert/strict";
import { allocateBookingResources, type AllocationUnit } from "../lib/resource-allocation";

const start = new Date("2026-08-12T09:00:00+07:00");
const end = new Date("2026-08-12T10:00:00+07:00");
const therapists = ["ktv-1", "ktv-2", "ktv-3"];
const beds = [
  { id: "a-1", facilityRoomId: "room-a" },
  { id: "a-2", facilityRoomId: "room-a" },
  { id: "a-3", facilityRoomId: "room-a" },
  { id: "b-1", facilityRoomId: "room-b" },
  { id: "b-2", facilityRoomId: "room-b" },
];

function groupUnits(count: number): AllocationUnit[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `guest-${index + 1}`,
    start,
    end,
    therapistCandidateIds: therapists,
    bedCandidateIds: beds.map((bed) => bed.id),
  }));
}

const together = allocateBookingResources({ units: groupUnits(3), beds, bookings: [], seatCapacity: 5, bufferMinutes: 5 });
assert.ok(together, "A three-person group should be accepted when three therapists and three beds are free.");
assert.equal(together.roomCount, 1, "The allocator must prefer one physical room.");
assert.equal(new Set(together.assignments.map((item) => item.therapistId)).size, 3);
assert.equal(new Set(together.assignments.map((item) => item.bedId)).size, 3);

const split = allocateBookingResources({
  units: groupUnits(3),
  beds,
  bookings: [{ startTime: start, endTime: end, therapistId: null, roomId: "a-3" }],
  seatCapacity: 5,
  bufferMinutes: 5,
});
assert.ok(split, "The group should fall back to nearby rooms when one room no longer has enough beds.");
assert.equal(split.roomCount, 2, "Splitting is allowed only after a same-room assignment becomes impossible.");

const noTherapist = allocateBookingResources({
  units: groupUnits(3),
  beds,
  bookings: [{ startTime: start, endTime: end, therapistId: "ktv-3", roomId: null }],
  seatCapacity: 5,
  bufferMinutes: 5,
});
assert.equal(noTherapist, null, "Capacity must not be advertised when only two therapists are free.");

const noSeatCapacity = allocateBookingResources({ units: groupUnits(3), beds, bookings: [], seatCapacity: 2, bufferMinutes: 5 });
assert.equal(noSeatCapacity, null, "The branch capacity guard must remain authoritative.");

const constrainedUnits = groupUnits(2);
constrainedUnits[0].therapistCandidateIds = ["ktv-1"];
constrainedUnits[1].therapistCandidateIds = ["ktv-1", "ktv-2"];
const constrained = allocateBookingResources({ units: constrainedUnits, beds, bookings: [], seatCapacity: 5, bufferMinutes: 5 });
assert.ok(constrained, "The matching algorithm should allocate the scarce therapist first.");
assert.equal(constrained.assignments.find((item) => item.unitKey === "guest-1")?.therapistId, "ktv-1");
assert.equal(constrained.assignments.find((item) => item.unitKey === "guest-2")?.therapistId, "ktv-2");

console.log("✓ Resource allocation validates complete group capacity and prefers a shared physical room.");
