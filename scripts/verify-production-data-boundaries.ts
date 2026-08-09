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
assert.ok(businessCatalog.includes('GLOBAL:business.onsite_program'), "Catalog doanh nghiệp chưa lấy chương trình onsite từ database.");
assert.ok(businessCatalog.includes("minimumTherapistsPerSession"), "Catalog doanh nghiệp thiếu quy mô đội onsite tối thiểu.");

const corporateClient = source("app/(customer)/doanh-nghiep/corporate-client.tsx");
assert.ok(corporateClient.includes("onsiteProgram.requiredAssets.map"), "Trang Business chưa hiển thị checklist vật tư onsite từ catalog thật.");
assert.ok(corporateClient.includes("onsiteProgram.returnVoucher.amount"), "Trang Business chưa hiển thị voucher kéo khách về cơ sở.");
assert.ok(corporateClient.includes("onsiteProgram.minimumTherapistsPerSession"), "Trang Business chưa áp dụng đội tối thiểu 5 KTV/buổi.");

const corporateInquiry = source("app/api/corporate-inquiries/route.ts");
assert.ok(corporateInquiry.includes("onsiteAssets: businessCatalog.onsiteProgram.requiredAssets"), "Hồ sơ Business chưa chụp lại checklist vật tư khi tạo.");
assert.ok(corporateInquiry.includes("returnVoucherCode: businessCatalog.onsiteProgram.returnVoucher.code"), "Hồ sơ Business chưa lưu voucher kéo về cơ sở.");

const financePage = source("app/admin/finance/page.tsx");
assert.ok(financePage.includes("getAdminSession()"), "Trang tài chính phải kiểm tra phiên quản trị trên server.");
assert.ok(financePage.includes('["OWNER", "BRANCH_MANAGER"].includes(session.role)'), "Trang tài chính chỉ được mở cho chủ sở hữu và quản lý cơ sở.");
assert.ok(financePage.includes("notFound()"), "Trang tài chính phải fail-closed khi sai vai trò.");

const adminNav = source("components/admin-nav.tsx");
assert.ok(adminNav.includes('const canManageFinance = ["OWNER", "BRANCH_MANAGER"].includes(session.role)'), "Điều hướng quản trị phải ẩn lối tắt tài chính và QR với vai trò không đủ quyền.");
assert.ok(adminNav.includes('canManageFinance ? <Link href="/admin/finance"'), "Lối tắt tài chính chưa được ràng buộc theo vai trò.");
assert.ok(adminNav.includes('canManageFinance ? <Link href="/admin/qr-management"'), "Lối tắt QR chưa được ràng buộc theo vai trò.");

const financeSummary = source("app/api/finance/summary/route.ts");
assert.ok(financeSummary.includes('requireAdminSession(["OWNER", "BRANCH_MANAGER"])'), "API tổng hợp tài chính phải khai báo rõ vai trò được phép.");

const adminDashboard = source("components/admin-dashboard-client.tsx");
assert.ok(adminDashboard.includes('const canManageFinance = Boolean(session && ["OWNER", "BRANCH_MANAGER"].includes(session.role))'), "Dashboard phải phân biệt vai trò được xem tài chính.");
assert.ok(adminDashboard.includes('if (canManageFinance) {'), "Dashboard không được gọi API tài chính với vai trò Lễ tân.");
assert.ok(adminDashboard.includes('...(canManageFinance ? [{ label: "Tổng thu"'), "KPI tài chính phải ẩn với vai trò không đủ quyền.");

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
