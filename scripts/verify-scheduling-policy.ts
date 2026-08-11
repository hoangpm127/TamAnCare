import assert from "node:assert/strict";
import { bookingWindowError, calculateSlotResources, intervalsOverlapWithBuffer, serviceEndMinute } from "../lib/scheduling-policy";
import { therapistWorksDuring } from "../lib/therapist-schedule";

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

const aliceStart = new Date("2026-08-12T18:00:00+07:00");
const aliceEnd = new Date("2026-08-12T19:00:00+07:00");
const therapistIds = ["ktv-nguyen-huy", "ktv-lan", "ktv-mai"];
const roomIds = ["room-1", "room-2", "room-3"];
const beforeAlice = calculateSlotResources({
  start: aliceStart,
  end: aliceEnd,
  bufferMinutes: 0,
  therapistIds,
  roomIds,
  seatCapacity: 3,
  bookings: [],
});
const afterAlice = calculateSlotResources({
  start: aliceStart,
  end: aliceEnd,
  bufferMinutes: 0,
  therapistIds,
  roomIds,
  seatCapacity: 3,
  bookings: [{
    startTime: aliceStart,
    endTime: aliceEnd,
    therapistId: "ktv-nguyen-huy",
    roomId: "room-1",
  }],
});
assert.equal(afterAlice.remainingCapacity, beforeAlice.remainingCapacity - 1, "Booking của Alice phải làm Bob thấy giảm đúng 1 chỗ.");
assert.ok(!afterAlice.availableTherapistIds.includes("ktv-nguyen-huy"), "Bob không được chọn Nguyễn Huy trong 18:00–19:00.");
const afterAliceEnds = calculateSlotResources({
  start: aliceEnd,
  end: new Date("2026-08-12T20:00:00+07:00"),
  bufferMinutes: 0,
  therapistIds,
  roomIds,
  seatCapacity: 3,
  bookings: [{
    startTime: aliceStart,
    endTime: aliceEnd,
    therapistId: "ktv-nguyen-huy",
    roomId: "room-1",
  }],
});
assert.ok(afterAliceEnds.availableTherapistIds.includes("ktv-nguyen-huy"), "Nguyễn Huy phải rảnh lại từ 19:00 khi không cấu hình buffer.");

const wednesdayShift = [{ weekday: 3, startMinute: 9 * 60, endMinute: 18 * 60, isActive: true }];
assert.equal(
  therapistWorksDuring(wednesdayShift, new Date("2026-08-12T17:00:00+07:00"), new Date("2026-08-12T18:00:00+07:00")),
  true,
  "Dịch vụ kết thúc đúng lúc hết ca phải được nhận.",
);
assert.equal(
  therapistWorksDuring(wednesdayShift, new Date("2026-08-12T18:00:00+07:00"), new Date("2026-08-12T19:00:00+07:00")),
  false,
  "KTV không được nhận dịch vụ kéo dài ra ngoài ca làm.",
);
assert.equal(
  therapistWorksDuring([{ weekday: 3, startMinute: 9 * 60, endMinute: 24 * 60 }], new Date("2026-08-12T23:00:00+07:00"), new Date("2026-08-13T00:00:00+07:00")),
  true,
  "Ca kết thúc lúc 24:00 phải nhận được dịch vụ kết thúc đúng nửa đêm.",
);

console.log("✓ Quy tắc thời lượng, KTV/giường và ca cuối đã đúng.");
