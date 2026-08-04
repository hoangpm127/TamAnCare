export type BookingWindowInput = {
  startMinute: number;
  durationMinutes: number;
  openTime: string;
  closeTime: string;
  lastBookingTime: string;
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
