import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const catalogConsumers = [
  "components/admin-nav.tsx",
  "components/admin-finance-center.tsx",
  "components/admin-dashboard-client.tsx",
  "components/admin-customer-timeline.tsx",
  "components/admin-calendar-operations.tsx",
  "components/admin-booking-operations.tsx",
  "components/admin-booking-calendar.tsx",
  "components/admin-quick-actions.tsx",
  "app/(customer)/doanh-nghiep/corporate-client.tsx",
];

for (const path of catalogConsumers) {
  const content = source(path);
  assert.ok(!content.includes("@/lib/demo-data"), `${path} không được dùng dữ liệu demo khi vận hành.`);
  assert.ok(!/catalog\?\.(branches|services|therapists)/.test(content), `${path} đang có nhánh fallback khi catalog chưa tải.`);
}

for (const path of ["app/(customer)/layout.tsx", "app/admin/layout.tsx"]) {
  const content = source(path);
  assert.ok(content.includes("getPublicCatalog"), `${path} phải lấy catalog thật từ server.`);
  assert.ok(content.includes("PublicCatalogProvider"), `${path} phải cấp catalog thật cho client.`);
}

const corporatePage = source("app/(customer)/doanh-nghiep/page.tsx");
assert.ok(corporatePage.includes("getBusinessCatalog"), "Trang doanh nghiệp phải lấy bảng giá từ database trên server.");
assert.ok(corporatePage.includes("businessCatalog={businessCatalog}"), "Trang doanh nghiệp chưa truyền catalog thật xuống form.");

const businessCatalog = source("lib/server/business-catalog.ts");
assert.ok(businessCatalog.includes('process.env.APP_ENV === "production"'), "Catalog doanh nghiệp thiếu chốt fail-closed cho production.");
assert.ok(businessCatalog.includes("configurationError"), "Catalog doanh nghiệp phải dừng khi cấu hình production không hợp lệ.");

for (const path of [
  "app/api/payments/[paymentId]/simulate/route.ts",
  "app/api/booking-groups/[referenceCode]/simulate-deposit/route.ts",
]) {
  const content = source(path);
  assert.ok(
    content.includes('process.env.APP_ENV === "uat"') && content.includes('process.env.ENABLE_UAT_PAYMENT_SIMULATION === "true"'),
    `${path} phải khóa mô phỏng thanh toán ngoài UAT.`,
  );
}

console.log(`✓ ${catalogConsumers.length} giao diện vận hành chỉ dùng dữ liệu thật; mô phỏng thanh toán bị khóa ngoài UAT.`);
