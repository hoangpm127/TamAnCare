import "server-only";

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
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    weekday: WEEKDAY_BY_SHORT_NAME[part("weekday")] ?? 1,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/**
 * Existing KTV without a configured weekly schedule remain available during
 * branch hours. Once at least one weekly row exists, that schedule is the
 * source of truth for customer availability and automatic assignment.
 */
export function therapistWorksDuring(
  schedules: WeeklyScheduleWindow[],
  start: Date,
  end: Date,
) {
  if (!schedules.length) return true;
  const startPosition = businessSchedulePosition(start);
  const endPosition = businessSchedulePosition(end);
  if (startPosition.weekday !== endPosition.weekday) return false;
  const window = schedules.find((item) => item.weekday === startPosition.weekday && item.isActive !== false);
  return Boolean(window
    && startPosition.minuteOfDay >= window.startMinute
    && endPosition.minuteOfDay <= window.endMinute);
}
