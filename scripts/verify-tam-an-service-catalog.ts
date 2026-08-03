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
const expectedPackages = new Map([
  ["pkg-3", { serviceId: "svc-neck-60", sessions: 3, paidSessions: 3, bonusSessions: 0, price: 1050000 }],
  ["pkg-foot-5", { serviceId: "svc-foot-60", sessions: 5, paidSessions: 5, bonusSessions: 0, price: 1575000 }],
  ["pkg-5", { serviceId: "svc-body-60", sessions: 5, paidSessions: 5, bonusSessions: 0, price: 2000000 }],
  ["pkg-9", { serviceId: "svc-neck-60", sessions: 10, paidSessions: 9, bonusSessions: 1, price: 3510000 }],
  ["pkg-body-9", { serviceId: "svc-body-60", sessions: 10, paidSessions: 9, bonusSessions: 1, price: 4050000 }],
  ["pkg-body-15", { serviceId: "svc-body-60", sessions: 17, paidSessions: 15, bonusSessions: 2, price: 6750000 }],
]);
const retiredPackageIds = ["pkg-19", "pkg-29", "pkg-49"];

async function main() {
  // PGlite, used for isolated migration tests, shares one database socket.
  // Keep these reads sequential so the same verification also runs there.
  const activeServices = await db.service.findMany({
    where: { isActive: true, isOnline: true },
    select: { id: true, basePrice: true },
  });
  const retiredServices = await db.service.findMany({
    where: { id: { in: retiredServiceIds } },
    select: { id: true, isActive: true, isOnline: true },
  });
  const activePackages = await db.packagePlan.findMany({
    where: { isActive: true },
    select: { id: true, serviceId: true, sessions: true, paidSessions: true, bonusSessions: true, price: true },
  });
  const retiredPackages = await db.packagePlan.findMany({
    where: { id: { in: retiredPackageIds } },
    select: { id: true, isActive: true },
  });

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
  assert.equal(activePackages.length, expectedPackages.size, "Danh mục phải có đúng 6 gói dài hạn đang bán.");
  for (const plan of activePackages) {
    assert.deepEqual(
      {
        serviceId: plan.serviceId,
        sessions: plan.sessions,
        paidSessions: plan.paidSessions,
        bonusSessions: plan.bonusSessions,
        price: plan.price,
      },
      expectedPackages.get(plan.id),
      `Gói ${plan.id} không khớp bảng giá dài hạn mới.`,
    );
  }
  assert.equal(retiredPackages.length, retiredPackageIds.length, "Thiếu gói cũ cần lưu lịch sử.");
  assert.ok(retiredPackages.every((plan) => !plan.isActive), "Gói giá cao cũ vẫn còn được bán.");

  console.log("✓ Danh mục Tâm An Center có đúng 11 dịch vụ và 6 gói dài hạn; các dịch vụ, gói giá cao cũ chỉ còn lưu lịch sử.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
