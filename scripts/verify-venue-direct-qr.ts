import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const landing = source("app/(customer)/tai-co-so/page.tsx");
assert.ok(landing.includes('const bookingPath = `/booking?source=${VENUE_DIRECT_SOURCE}`'), "Trang QR trực tiếp phải giữ nguồn khi sang đặt lịch.");
assert.ok(landing.includes("Không qua Affiliate"), "Trang QR trực tiếp phải giải thích rõ không tạo Affiliate.");
assert.ok(landing.includes("Đây không phải mã check-in"), "Trang QR trực tiếp không được làm khách hiểu nhầm là QR check-in.");
assert.ok(!landing.includes("captureReferralAttribution"), "QR trực tiếp không được tự tạo ghi nhận Affiliate.");

const qrPage = source("app/admin/qr-management/page.tsx");
assert.ok(qrPage.includes('new URL("/tai-co-so"'), "QR tổng phải trỏ tới trang khách trực tiếp cố định.");
assert.ok(qrPage.includes('targetType: "DIRECT"'), "QR tổng phải có loại DIRECT riêng với QR Business.");

const qrManagement = source("components/admin-qr-management.tsx");
assert.ok(qrManagement.includes('item.targetType === "BUSINESS" ? <button'), "Chỉ QR Business mới được cấp lại và vô hiệu mã cũ.");
assert.ok(qrManagement.includes("tam-an-center-qr-khach-truc-tiep.png"), "QR trực tiếp phải có tên file tải xuống ổn định.");

const registerPage = source("app/(customer)/tai-khoan/page.tsx");
const registerClient = source("app/(customer)/tai-khoan/customer-account-client.tsx");
const registerApi = source("app/api/customer-auth/register/route.ts");
assert.ok(registerPage.includes('signupSource={isVenueDirectSource(first(query.source)) ? "VENUE_DIRECT" : undefined}'), "Trang đăng ký phải truyền nguồn trực tiếp theo danh sách cho phép.");
assert.ok(registerClient.includes("source: signupSource"), "Form đăng ký phải gửi nguồn trực tiếp xuống API.");
assert.ok(registerApi.includes("source: z.literal(VENUE_DIRECT_SOURCE).optional()"), "API chỉ được nhận đúng mã nguồn khách trực tiếp.");
assert.ok(registerApi.includes('firstSource: parsed.data.source ?? "CUSTOMER_SIGNUP"'), "Khách mới từ QR phải được lưu nguồn đầu tiên.");

const bookingClient = source("app/(customer)/booking/booking-client.tsx");
const paymentFlow = source("app/(customer)/booking/success/[bookingCode]/booking-payment-flow.tsx");
assert.ok(bookingClient.includes('params.get("source")'), "Luồng đặt lịch phải đọc nguồn từ QR.");
assert.ok(bookingClient.includes("source,"), "Yêu cầu đặt lịch phải lưu nguồn trong bản nháp thanh toán.");
assert.ok(paymentFlow.includes("source: draft.requestPayloads[0]?.source"), "Thanh toán cọc phải gửi nguồn xuống BookingGroup.");

const bookingApi = source("app/api/booking-groups/route.ts");
assert.ok(bookingApi.includes("campaignCode: installedReferral?.code"), "Affiliate phải tiếp tục do server quyết định, không lấy từ QR trực tiếp.");

console.log("✓ QR tổng khách trực tiếp mở đúng trang, lưu nguồn qua đăng ký/đặt lịch và không tự tạo Affiliate.");
