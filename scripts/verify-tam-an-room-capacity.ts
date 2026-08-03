import assert from "node:assert/strict";
import { db } from "../lib/db";

const branchId = "tam-an-center-tay-ho";
const bodyCategories = ["BODY", "NECK_SHOULDER", "THERAPY", "COMBO"] as const;

async function main() {
  const [branch, rooms, bodyTherapists, footTherapists] = await Promise.all([
    db.branch.findUnique({ where: { id: branchId }, select: { seatCapacity: true } }),
    db.room.findMany({
      where: { branchId, status: "ACTIVE" },
      select: { type: true, suitableCategories: true },
    }),
    db.therapist.count({
      where: { branchId, status: "ACTIVE", onlineBooking: true, services: { some: { id: "svc-body-60" } } },
    }),
    db.therapist.count({
      where: { branchId, status: "ACTIVE", onlineBooking: true, services: { some: { id: "svc-foot-60" } } },
    }),
  ]);

  assert.ok(branch, "Không tìm thấy cơ sở Tây Hồ.");
  assert.equal(branch.seatCapacity, 18, "Công suất cơ sở phải là 18 chỗ.");
  assert.equal(rooms.length, 18, "Cơ sở phải có đúng 18 giường/ghế đang hoạt động.");
  assert.equal(rooms.filter((room) => room.type === "HEAD_SPA_BED").length, 3, "Phải có 3 giường gội.");
  assert.equal(rooms.filter((room) => room.type === "FOOT_CHAIR").length, 6, "Phải có 6 ghế Foot.");
  assert.equal(rooms.filter((room) => room.type === "MASSAGE_BED").length, 9, "Phải có 9 giường Body.");
  assert.ok(
    rooms.filter((room) => room.type === "MASSAGE_BED").every((room) =>
      bodyCategories.every((category) => room.suitableCategories.includes(category)),
    ),
    "Giường Body phải nhận đủ nhóm dịch vụ Body, cổ vai gáy, trị liệu và combo.",
  );

  const bodyRooms = rooms.filter((room) => room.suitableCategories.includes("BODY")).length;
  const footRooms = rooms.filter((room) => room.suitableCategories.includes("FOOT")).length;
  assert.ok(Math.min(branch.seatCapacity, bodyRooms, bodyTherapists) > 0, "Lịch Body phải có đủ KTV và giường để mở.");
  assert.ok(Math.min(branch.seatCapacity, footRooms, footTherapists) > 0, "Lịch Foot phải có đủ KTV và ghế để mở.");

  console.log("✓ Công suất Tâm An Center: 3 giường gội + 6 ghế Foot + 9 giường Body = 18 chỗ; lịch Body và Foot đã mở.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
