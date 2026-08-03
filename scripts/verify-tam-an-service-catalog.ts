import assert from "node:assert/strict";
import { db } from "../lib/db";

const expectedServices = new Map<string, number>([
  ["svc-body-60", 450000],
  ["svc-neck-60", 390000],
  ["svc-foot-60", 350000],
  ["svc-back-60", 390000],
  ["svc-steam-15", 150000],
  ["svc-cupping", 150000],
  ["svc-hot-stone", 80000],
  ["svc-mugwort-mud", 150000],
  ["svc-hot-herbal", 250000],
  ["svc-head-energy-45", 450000],
  ["svc-belly-45", 350000],
]);

const retiredServiceIds = ["svc-body-90", "svc-body-120", "svc-neck-90", "svc-foot-90", "svc-back-90"];

async function main() {
  const [activeServices, retiredServices, activePackages] = await Promise.all([
    db.service.findMany({
      where: { isActive: true, isOnline: true },
      select: { id: true, basePrice: true },
    }),
    db.service.findMany({
      where: { id: { in: retiredServiceIds } },
      select: { id: true, isActive: true, isOnline: true },
    }),
    db.packagePlan.findMany({ where: { isActive: true }, select: { id: true, serviceId: true } }),
  ]);

  assert.equal(activeServices.length, expectedServices.size, "Danh mục online phải có đúng 11 dịch vụ trong bảng giá.");
  for (const service of activeServices) {
    assert.equal(service.basePrice, expectedServices.get(service.id), `Giá hoặc mã dịch vụ ${service.id} không khớp bảng giá.`);
  }
  assert.equal(retiredServices.length, retiredServiceIds.length, "Thiếu bản ghi dịch vụ cần lưu lịch sử.");
  assert.ok(retiredServices.every((service) => !service.isActive && !service.isOnline), "Dịch vụ ngoài bảng giá vẫn còn được bán.");
  assert.ok(
    activePackages.every((plan) => !plan.serviceId || expectedServices.has(plan.serviceId)),
    "Gói liệu trình đang trỏ tới dịch vụ đã ngừng bán.",
  );

  console.log("✓ Danh mục Tâm An Center chỉ còn 11 dịch vụ đúng bảng giá; 5 bản thời lượng cao đã được ẩn.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
