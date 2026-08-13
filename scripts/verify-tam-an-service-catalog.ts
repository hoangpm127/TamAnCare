import assert from "node:assert/strict";
import { db } from "../lib/db";

const expectedServices = new Map<string, { price: number; tip: number }>([
  ["svc-body-60", { price: 450000, tip: 80000 }],
  ["svc-body-90", { price: 650000, tip: 120000 }],
  ["svc-body-120", { price: 790000, tip: 160000 }],
  ["svc-foot-60", { price: 350000, tip: 60000 }],
  ["svc-foot-90", { price: 490000, tip: 90000 }],
  ["svc-foot-120", { price: 610000, tip: 120000 }],
  ["svc-neck-60", { price: 390000, tip: 70000 }],
  ["svc-neck-90", { price: 510000, tip: 105000 }],
  ["svc-neck-120", { price: 650000, tip: 140000 }],
  ["svc-cupping", { price: 150000, tip: 30000 }],
  ["svc-head-energy-45", { price: 450000, tip: 80000 }],
  ["svc-head-energy-90", { price: 650000, tip: 120000 }],
  ["svc-head-energy-120", { price: 790000, tip: 160000 }],
  ["svc-steam-15", { price: 150000, tip: 0 }],
  ["svc-expert-consult-15", { price: 300000, tip: 100000 }],
]);

const retiredServiceIds = ["svc-back-60", "svc-hot-stone", "svc-mugwort-mud", "svc-hot-herbal", "svc-belly-45"];
const expectedPackages = new Map([
  ["pkg-5", { serviceId: "svc-body-60", sessions: 5, paidSessions: 5, bonusSessions: 0, validityDays: 60, price: 1950000 }],
  ["pkg-9", { serviceId: "svc-body-60", sessions: 10, paidSessions: 10, bonusSessions: 0, validityDays: 90, price: 3500000 }],
  ["pkg-body-60-15", { serviceId: "svc-body-60", sessions: 15, paidSessions: 15, bonusSessions: 0, validityDays: 90, price: 4800000 }],
  ["pkg-body-90-5", { serviceId: "svc-body-90", sessions: 5, paidSessions: 5, bonusSessions: 0, validityDays: 60, price: 2750000 }],
  ["pkg-body-90-10", { serviceId: "svc-body-90", sessions: 10, paidSessions: 10, bonusSessions: 0, validityDays: 90, price: 5000000 }],
  ["pkg-body-90-15", { serviceId: "svc-body-90", sessions: 15, paidSessions: 15, bonusSessions: 0, validityDays: 90, price: 6750000 }],
  ["pkg-body-120-5", { serviceId: "svc-body-120", sessions: 5, paidSessions: 5, bonusSessions: 0, validityDays: 90, price: 3450000 }],
  ["pkg-body-120-10", { serviceId: "svc-body-120", sessions: 10, paidSessions: 10, bonusSessions: 0, validityDays: 90, price: 6500000 }],
  ["pkg-body-120-15", { serviceId: "svc-body-120", sessions: 15, paidSessions: 15, bonusSessions: 0, validityDays: 90, price: 9000000 }],
]);
const retiredPackageIds = ["pkg-3", "pkg-19", "pkg-29", "pkg-49", "pkg-foot-5", "pkg-body-9", "pkg-body-15"];

async function main() {
  // PGlite, used for isolated migration tests, shares one database socket.
  // Keep these reads sequential so the same verification also runs there.
  const activeServices = await db.service.findMany({
    where: { isActive: true, isOnline: true },
    select: { id: true, basePrice: true, therapistFee: true, suggestedTip: true },
  });
  const retiredServices = await db.service.findMany({
    where: { id: { in: retiredServiceIds } },
    select: { id: true, isActive: true, isOnline: true },
  });
  const activePackages = await db.packagePlan.findMany({
    where: { isActive: true },
    select: { id: true, serviceId: true, sessions: true, paidSessions: true, bonusSessions: true, validityDays: true, price: true },
  });
  const retiredPackages = await db.packagePlan.findMany({
    where: { id: { in: retiredPackageIds } },
    select: { id: true, isActive: true },
  });

  assert.equal(activeServices.length, expectedServices.size, "Danh mục online phải có đúng 15 dịch vụ trong phiếu nghiệp vụ.");
  for (const service of activeServices) {
    const expected = expectedServices.get(service.id);
    assert.ok(expected, `Dịch vụ ${service.id} nằm ngoài phiếu nghiệp vụ.`);
    assert.equal(service.basePrice, expected.price, `Giá dịch vụ ${service.id} không khớp phiếu nghiệp vụ.`);
    assert.equal(service.suggestedTip, expected.tip, `Tip gợi ý ${service.id} không khớp phiếu nghiệp vụ.`);
    assert.equal(service.therapistFee, 0, `Tip ${service.id} không được nằm trong Bill.`);
  }
  assert.equal(retiredServices.length, retiredServiceIds.length, "Thiếu bản ghi dịch vụ cần lưu lịch sử.");
  assert.ok(retiredServices.every((service) => !service.isActive && !service.isOnline), "Dịch vụ ngoài bảng giá vẫn còn được bán.");
  assert.ok(
    activePackages.every((plan) => !plan.serviceId || expectedServices.has(plan.serviceId)),
    "Gói liệu trình đang trỏ tới dịch vụ đã ngừng bán.",
  );
  assert.equal(activePackages.length, expectedPackages.size, "Danh mục phải có đúng 9 gói dài hạn đang bán.");
  for (const plan of activePackages) {
    assert.deepEqual(
      {
        serviceId: plan.serviceId,
        sessions: plan.sessions,
        paidSessions: plan.paidSessions,
        bonusSessions: plan.bonusSessions,
        validityDays: plan.validityDays,
        price: plan.price,
      },
      expectedPackages.get(plan.id),
      `Gói ${plan.id} không khớp bảng giá dài hạn mới.`,
    );
  }
  assert.equal(retiredPackages.length, retiredPackageIds.length, "Thiếu gói cũ cần lưu lịch sử.");
  assert.ok(retiredPackages.every((plan) => !plan.isActive), "Gói giá cao cũ vẫn còn được bán.");

  console.log("✓ Danh mục Tâm An Center có đúng 15 dịch vụ và 9 gói dài hạn; Tip nằm ngoài Bill và dữ liệu cũ chỉ còn lưu lịch sử.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
