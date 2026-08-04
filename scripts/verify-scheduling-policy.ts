import assert from "node:assert/strict";
import { bookingWindowError, intervalsOverlapWithBuffer, serviceEndMinute } from "../lib/scheduling-policy";

const branchHours = { openTime: "09:00", closeTime: "21:00", lastBookingTime: "20:45" };

assert.equal(serviceEndMinute(10 * 60, 90), 11 * 60 + 30, "Ca 10:00/90 phút phải kết thúc lúc 11:30.");
assert.equal(bookingWindowError({ ...branchHours, startMinute: 10 * 60, durationMinutes: 90 }), null);
assert.equal(bookingWindowError({ ...branchHours, startMinute: 20 * 60, durationMinutes: 60 }), null);
assert.equal(bookingWindowError({ ...branchHours, startMinute: 20 * 60 + 45, durationMinutes: 15 }), null);
assert.ok(bookingWindowError({ ...branchHours, startMinute: 20 * 60 + 45, durationMinutes: 30 }));
assert.match(bookingWindowError({ ...branchHours, startMinute: 21 * 60, durationMinutes: 15 }) ?? "", /ngoài giờ nhận khách/);

const serviceStart = new Date("2026-07-25T10:00:00+07:00");
const serviceEnd = new Date("2026-07-25T11:30:00+07:00");
assert.equal(
  intervalsOverlapWithBuffer(new Date("2026-07-25T11:00:00+07:00"), new Date("2026-07-25T12:00:00+07:00"), serviceStart, serviceEnd, 0),
  true,
  "KTV/giường phải còn bận khi dịch vụ chưa kết thúc.",
);
assert.equal(
  intervalsOverlapWithBuffer(new Date("2026-07-25T11:30:00+07:00"), new Date("2026-07-25T12:30:00+07:00"), serviceStart, serviceEnd, 0),
  false,
  "KTV/giường hết thời lượng phục vụ đúng lúc 11:30.",
);
assert.equal(
  intervalsOverlapWithBuffer(new Date("2026-07-25T11:30:00+07:00"), new Date("2026-07-25T12:30:00+07:00"), serviceStart, serviceEnd, 5),
  true,
  "Khoảng chuẩn bị 5 phút phải tiếp tục khóa tài nguyên đến 11:35.",
);

console.log("✓ Quy tắc thời lượng, KTV/giường và ca cuối đã đúng.");
