import assert from "node:assert/strict";
import {
  attendanceCheckInSnapshot,
  vietnamMinuteOfDay,
  vietnamWeekday,
  vietnamWorkDate,
} from "../lib/attendance-policy";

const mondayOnTime = new Date("2026-08-10T09:05:00+07:00");
const mondayLate = new Date("2026-08-10T09:11:00+07:00");
const schedules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 18 * 60, isActive: true }];

assert.equal(vietnamWeekday(mondayOnTime), 1, "Ngày làm việc phải tính theo múi giờ Việt Nam.");
assert.equal(vietnamMinuteOfDay(mondayOnTime), 9 * 60 + 5, "Phút trong ngày phải tính theo giờ Việt Nam.");
assert.equal(vietnamWorkDate(mondayOnTime).toISOString(), "2026-08-10T00:00:00.000Z");
assert.deepEqual(attendanceCheckInSnapshot(schedules, mondayOnTime), {
  scheduledStartMinute: 540,
  scheduledEndMinute: 1080,
  lateMinutes: 5,
  status: "PRESENT",
});
assert.deepEqual(attendanceCheckInSnapshot(schedules, mondayLate), {
  scheduledStartMinute: 540,
  scheduledEndMinute: 1080,
  lateMinutes: 11,
  status: "LATE",
});
assert.deepEqual(attendanceCheckInSnapshot([], mondayLate), {
  scheduledStartMinute: null,
  scheduledEndMinute: null,
  lateMinutes: 0,
  status: "PRESENT",
});

console.log("✓ Quy tắc ngày công, ca làm và ngưỡng đi muộn của KTV đã đúng.");
