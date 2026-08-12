import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminSections } from "../lib/demo-data";
import { ADMIN_AFFILIATE_PERIOD_OPTIONS } from "../lib/admin-affiliate-types";

const sectionOrder = Object.keys(adminSections);
assert.equal(sectionOrder.indexOf("affiliates") + 1, sectionOrder.indexOf("capacity"), "Tab Affiliates phải đứng ngay trước Công suất.");
assert.deepEqual(
  ADMIN_AFFILIATE_PERIOD_OPTIONS.map((item) => item.value),
  ["today", "7d", "14d", "30d", "90d", "180d", "365d"],
  "Bộ lọc thời gian Affiliate chưa đủ các kỳ kinh doanh.",
);

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260812163000_admin_affiliate_reconciliation/migration.sql", import.meta.url), "utf8");
const bookingStatusRoute = readFileSync(new URL("../app/api/bookings/[bookingCode]/status/route.ts", import.meta.url), "utf8");
const payoutRoute = readFileSync(new URL("../app/api/admin-affiliates/[commissionId]/payout/route.ts", import.meta.url), "utf8");
const reportSource = readFileSync(new URL("../lib/server/admin-affiliate-report.ts", import.meta.url), "utf8");
const screenSource = readFileSync(new URL("../components/admin-affiliate-center.tsx", import.meta.url), "utf8");

assert.ok(schema.includes("model AffiliatePayout") && schema.includes("commissionLedgerEntryId String"), "Schema phải liên kết sổ đối soát với bút toán hoa hồng.");
assert.ok(migration.includes("ledger.\"occurredAt\" + INTERVAL '15 days'") && migration.includes("ON CONFLICT"), "Migration phải đưa hoa hồng cũ vào kỳ đối soát 15 ngày an toàn.");
assert.ok(bookingStatusRoute.includes("tx.affiliatePayout.create") && bookingStatusRoute.includes('actionUrl: "/admin/affiliates"'), "Hoa hồng mới phải tạo dòng đối soát và dẫn Admin tới đúng trang.");
assert.ok(payoutRoute.includes('requireAdminSession(["OWNER"])') && payoutRoute.includes("AFFILIATE_COMMISSION_PAID") && payoutRoute.includes("bankAccountSnapshot"), "Xác nhận chuyển khoản phải giới hạn Admin và lưu dấu vết nhận tiền.");
assert.ok(reportSource.includes("guestReferrals") && reportSource.includes("invitedCustomers") && reportSource.includes("overdueAmount"), "Báo cáo phải gồm khách được giới thiệu và số tiền quá hạn.");
assert.ok(screenSource.includes("Đã thanh toán") && screenSource.includes("Xác nhận đã chuyển khoản") && screenSource.includes("Khách hàng đã giới thiệu"), "Giao diện phải đủ bộ lọc, thao tác và danh sách khách được mời.");

console.log("Admin Affiliate reconciliation verified: navigation, periods, ledger, payout audit and referral profiles.");
