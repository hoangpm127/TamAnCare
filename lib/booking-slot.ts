import { addMinutes, format, isBefore, isSameDay, parseISO, setHours, setMinutes } from "date-fns";
import { bookings, branch, rooms, services, therapists, type DemoBooking, type DemoRoom, type DemoService, type DemoTherapist } from "./demo-data";
import { minutesToTime } from "./utils";
import { bookingWindowError, intervalsOverlapWithBuffer, timeToMinutes } from "./scheduling-policy";

export type SlotInput = {
  serviceId: string;
  date: string;
  durationMinutes?: number;
  therapistId?: string;
  branchId?: string;
};

export type AvailableSlot = {
  startTime: string;
  endTime: string;
  availableTherapists: Pick<DemoTherapist, "id" | "fullName" | "ratingAvg">[];
  availableRooms: Pick<DemoRoom, "id" | "name" | "type">[];
  remainingCapacity: number;
};

const blockingStatuses = new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"]);

function isTherapistFree(therapistId: string, start: Date, end: Date, dayBookings: DemoBooking[], bufferMinutes: number) {
  return !dayBookings.some(
    (booking) =>
      booking.therapistId === therapistId &&
      blockingStatuses.has(booking.status) &&
      intervalsOverlapWithBuffer(start, end, booking.startTime, booking.endTime, bufferMinutes),
  );
}

function isRoomFree(roomId: string, start: Date, end: Date, dayBookings: DemoBooking[], bufferMinutes: number) {
  return !dayBookings.some(
    (booking) =>
      booking.roomId === roomId &&
      blockingStatuses.has(booking.status) &&
      intervalsOverlapWithBuffer(start, end, booking.startTime, booking.endTime, bufferMinutes),
  );
}

export function generateAvailableSlots(input: SlotInput): AvailableSlot[] {
  const service = services.find((item) => item.id === input.serviceId) ?? services[0];
  const duration = input.durationMinutes ?? service.durationMin;
  const date = parseISO(input.date);
  const open = timeToMinutes(branch.openTime);
  const lastBooking = timeToMinutes(branch.lastBookingTime);
  const buffer = branch.bufferMinutes;
  const dayBookings = bookings.filter((booking) => isSameDay(booking.startTime, date));
  const matchingTherapists = therapists.filter((therapist) => {
    const acceptsService = therapist.serviceIds.includes(service.id);
    const online = therapist.status === "ACTIVE";
    const requested = !input.therapistId || input.therapistId === therapist.id;
    const atBranch = !input.branchId || therapist.branchId === input.branchId;
    return acceptsService && online && requested && atBranch;
  });
  const matchingRooms = rooms.filter((room) => room.status === "ACTIVE" && room.suitableCategories.includes(service.category));

  const slots: AvailableSlot[] = [];
  for (let minute = open; minute <= lastBooking; minute += 15) {
    if (bookingWindowError({
      startMinute: minute,
      durationMinutes: duration,
      openTime: branch.openTime,
      closeTime: branch.closeTime,
      lastBookingTime: branch.lastBookingTime,
    })) continue;
    const start = setMinutes(setHours(date, Math.floor(minute / 60)), minute % 60);
    const end = addMinutes(start, duration);

    if (isBefore(start, new Date())) {
      continue;
    }

    const availableTherapists = matchingTherapists
      .filter((therapist) => isTherapistFree(therapist.id, start, end, dayBookings, buffer))
      .map(({ id, fullName, ratingAvg }) => ({ id, fullName, ratingAvg }));
    const availableRooms = matchingRooms
      .filter((room) => isRoomFree(room.id, start, end, dayBookings, buffer))
      .map(({ id, name, type }) => ({ id, name, type }));
    const remainingCapacity = Math.min(availableTherapists.length, availableRooms.length);

    if (remainingCapacity > 0) {
      slots.push({
        startTime: `${format(start, "yyyy-MM-dd")}T${minutesToTime(minute)}:00`,
        endTime: format(end, "yyyy-MM-dd'T'HH:mm:ss"),
        availableTherapists,
        availableRooms,
        remainingCapacity,
      });
    }
  }

  return slots;
}

export function calculateServiceTotal(service: Pick<DemoService, "basePrice" | "therapistFee">, discountAmount = 0) {
  return Math.max(service.basePrice + service.therapistFee - discountAmount, 0);
}
