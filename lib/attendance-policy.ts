function vietnamDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

export function vietnamWorkDate(value = new Date()) {
  return new Date(`${vietnamDateParts(value).date}T00:00:00.000Z`);
}

export function vietnamWeekday(value = new Date()) {
  const { date } = vietnamDateParts(value);
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

export function vietnamMinuteOfDay(value = new Date()) {
  const parts = vietnamDateParts(value);
  return parts.hour * 60 + parts.minute;
}

export function attendanceCheckInSnapshot(
  schedules: Array<{ weekday: number; startMinute: number; endMinute: number; isActive: boolean }>,
  now = new Date(),
) {
  const schedule = schedules.find((item) => item.weekday === vietnamWeekday(now) && item.isActive);
  const currentMinute = vietnamMinuteOfDay(now);
  const lateMinutes = schedule ? Math.max(0, currentMinute - schedule.startMinute) : 0;
  return {
    scheduledStartMinute: schedule?.startMinute ?? null,
    scheduledEndMinute: schedule?.endMinute ?? null,
    lateMinutes,
    status: schedule && lateMinutes > 10 ? "LATE" as const : "PRESENT" as const,
  };
}
