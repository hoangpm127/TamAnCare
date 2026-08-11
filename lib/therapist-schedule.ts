const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type WeeklyScheduleWindow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
};

const WEEKDAY_BY_SHORT_NAME: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function businessSchedulePosition(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: WEEKDAY_BY_SHORT_NAME[part("weekday")] ?? 1,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/** Weekly schedules are the source of truth for customer availability and automatic assignment. */
export function therapistWorksDuring(
  schedules: WeeklyScheduleWindow[],
  start: Date,
  end: Date,
) {
  if (!schedules.length) return false;
  const startPosition = businessSchedulePosition(start);
  const endPosition = businessSchedulePosition(end);
  const endMinute = startPosition.date === endPosition.date
    ? endPosition.minuteOfDay
    : endPosition.date === nextDate(startPosition.date) && endPosition.minuteOfDay === 0
      ? 24 * 60
      : null;
  if (endMinute === null) return false;
  const window = schedules.find((item) => item.weekday === startPosition.weekday && item.isActive !== false);
  return Boolean(window
    && startPosition.minuteOfDay >= window.startMinute
    && endMinute <= window.endMinute);
}
