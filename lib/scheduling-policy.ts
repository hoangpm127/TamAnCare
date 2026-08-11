export type BookingWindowInput = {
  startMinute: number;
  durationMinutes: number;
  openTime: string;
  closeTime: string;
  lastBookingTime: string;
};

export type ScheduledResourceBooking = {
  startTime: Date;
  endTime: Date;
  therapistId: string | null;
  roomId: string | null;
};

export type SlotResourceInput = {
  start: Date;
  end: Date;
  bufferMinutes: number;
  therapistIds: string[];
  roomIds: string[];
  seatCapacity: number;
  bookings: ScheduledResourceBooking[];
};

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function serviceEndMinute(startMinute: number, durationMinutes: number) {
  return startMinute + durationMinutes;
}

export function bookingWindowError(input: BookingWindowInput) {
  const openMinute = timeToMinutes(input.openTime);
  const closeMinute = timeToMinutes(input.closeTime);
  const lastBookingMinute = timeToMinutes(input.lastBookingTime);

  if (input.startMinute < openMinute || input.startMinute > lastBookingMinute) {
    return `Khung giờ nằm ngoài giờ nhận khách ${input.openTime}–${input.lastBookingTime}.`;
  }
  if (serviceEndMinute(input.startMinute, input.durationMinutes) > closeMinute) {
    return `Dịch vụ phải kết thúc trước giờ đóng cửa ${input.closeTime}.`;
  }
  return null;
}

export function intervalsOverlapWithBuffer(
  start: Date,
  end: Date,
  otherStart: Date,
  otherEnd: Date,
  bufferMinutes: number,
) {
  const bufferMs = bufferMinutes * 60_000;
  return start.getTime() < otherEnd.getTime() + bufferMs && end.getTime() > otherStart.getTime() - bufferMs;
}

export function calculateSlotResources(input: SlotResourceInput) {
  const overlappingBookings = input.bookings.filter((booking) =>
    intervalsOverlapWithBuffer(
      input.start,
      input.end,
      booking.startTime,
      booking.endTime,
      input.bufferMinutes,
    ),
  );
  const busyTherapists = new Set(overlappingBookings.map((booking) => booking.therapistId).filter(Boolean));
  const busyRooms = new Set(overlappingBookings.map((booking) => booking.roomId).filter(Boolean));
  const availableTherapistIds = input.therapistIds.filter((id) => !busyTherapists.has(id));
  const availableRoomIds = input.roomIds.filter((id) => !busyRooms.has(id));
  const remainingSeatCapacity = Math.max(0, input.seatCapacity - overlappingBookings.length);

  return {
    availableTherapistIds,
    availableRoomIds,
    remainingCapacity: Math.min(
      availableTherapistIds.length,
      availableRoomIds.length,
      remainingSeatCapacity,
    ),
  };
}
