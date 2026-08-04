import assert from "node:assert/strict";
import {
  CUSTOMER_LANGUAGES,
  CUSTOMER_TRANSLATION_SOURCE_KEYS,
  isCustomerLanguage,
  translateCustomerText,
} from "../lib/customer-i18n";
import { EXACT_ENGLISH } from "../lib/customer-i18n-en.generated";
import { EXACT_CHINESE } from "../lib/customer-i18n-zh.generated";

assert.deepEqual(CUSTOMER_LANGUAGES, ["vi", "ko", "en", "zh"]);
for (const language of CUSTOMER_LANGUAGES) assert.ok(isCustomerLanguage(language));
assert.ok(!isCustomerLanguage("fr"));

const englishKeys = new Set(Object.keys(EXACT_ENGLISH));
const chineseKeys = new Set(Object.keys(EXACT_CHINESE));
assert.ok(CUSTOMER_TRANSLATION_SOURCE_KEYS.length >= 1_100, "The customer copy inventory is unexpectedly small.");
for (const source of CUSTOMER_TRANSLATION_SOURCE_KEYS) {
  assert.ok(englishKeys.has(source), `Missing English copy: ${source}`);
  assert.ok(chineseKeys.has(source), `Missing Chinese copy: ${source}`);
}

const criticalCopy = [
  ["Trang chủ", "Home", "首页"],
  ["Ưu đãi", "Offers", "优惠"],
  ["Đặt lịch", "Book", "预约"],
  ["Tôi", "Me", "我的"],
  ["Tiếng Anh", "English", "英语"],
  ["Tiếng Trung", "Simplified Chinese", "简体中文"],
  ["Chọn KTV", "Choose a therapist", "选择理疗师"],
  ["Gửi mã OTP", "Send OTP", "发送验证码"],
  ["Cổ Vai Gáy 3 buổi", "Neck & shoulder care · 3 sessions", "颈肩护理 · 3次"],
  ["Bill Tâm An Business", "TÂM AN BUSINESS bill", "TÂM AN BUSINESS 账单"],
  ["Đã hết lượt", "Fully used", "已全部使用"],
  ["0đ", "0 ₫", "0 ₫"],
  ["Mời bạn", "Invite a friend", "邀请朋友"],
  ["Tâm An Business", "TÂM AN BUSINESS", "TÂM AN BUSINESS"],
  ["Thử tải lại", "Try again", "重试"],
  ["Đặt trước massage Body, cổ vai gáy, chân, lưng hông và các liệu trình chăm sóc chuyên sâu trong dưới 60 giây.", "Book full-body, neck & shoulder, foot, back & hip massage and specialized wellness programs in under 60 seconds.", "不到60秒即可预约全身、颈肩、足部、腰背与髋部按摩，以及专业健康护理项目。"],
  ["Tăng cường sức khỏe vào Buổi Trưa ngay tại Văn Phòng", "Midday wellness at your office", "午间到企健康护理"],
  ["Hết lượt", "Fully claimed", "已领完"],
  ["Chạm sóc toàn diện, nâng niu từng cảm giác", "Complete care, thoughtfully tending to every sensation", "全方位呵护，细致照顾每一处感受"],
  ["Tạo tài khoản nhận ưu đãi 150K", "Create an account and receive a 150K voucher", "创建账户即享150K优惠券"],
  ["Kiểm tra KTV và phòng/giường với thời gian chuẩn bị 5 phút.", "Therapist and room/bed availability includes a 5-minute preparation buffer.", "理疗师与房间/床位的可预约时间均预留5分钟准备时间。"],
  ["10% doanh thu dịch vụ/gói đủ điều kiện · đối soát 15 ngày", "10% of eligible service/package revenue · 15-day payout cycle", "符合条件的服务/套餐收入10% · 15天结算"],
] as const;

for (const [source, expectedEnglish, expectedChinese] of criticalCopy) {
  assert.equal(translateCustomerText(source, "en"), expectedEnglish, `Unexpected English copy for: ${source}`);
  assert.equal(translateCustomerText(source, "zh"), expectedChinese, `Unexpected Chinese copy for: ${source}`);
}
assert.equal(translateCustomerText("Tạo tài khoản nhận ưu đãi 150K", "ko"), "계정을 만들고 150K 혜택 받기");
assert.equal(translateCustomerText("Hồ sơ nhận đối soát", "ko"), "정산 수령 정보");

const dynamicGreeting = "Xin chào! Mình là trợ lý tự động của Tâm An Center · Tây Hồ. Nội dung chỉ mang tính hướng dẫn và không được chuyển trực tiếp cho lễ tân.";
assert.match(translateCustomerText(dynamicGreeting, "en"), /automated assistant.+guidance only/i);
assert.match(translateCustomerText(dynamicGreeting, "zh"), /自动咨询助手.+仅供指引/);
assert.equal(translateCustomerText("Thêm 500.000đ để lên hạng VIP.", "en"), "Spend 500.000 ₫ more to reach VIP status.");
assert.equal(translateCustomerText("Thêm 500.000đ để lên hạng VIP.", "zh"), "再消费 500.000 ₫ 即可升级为 VIP。");
assert.equal(translateCustomerText("Thu +500.000đ", "en"), "Income +500.000 ₫");
assert.equal(translateCustomerText("Chi -200.000đ", "zh"), "支出 -200.000 ₫");
assert.equal(translateCustomerText("HSD 03/08/2027", "en"), "Expires 03/08/2027");
assert.equal(translateCustomerText("HSD 03/08/2027", "zh"), "有效期至 03/08/2027");

for (const language of ["en", "zh"] as const) {
  const therapistCopy = translateCustomerText("KTV chuyên nghiệp", language);
  assert.ok(!therapistCopy.includes("KTV"), `${language} still exposes the internal KTV abbreviation.`);
  assert.ok(!translateCustomerText("Bill đã đặt chỗ", language).includes("比尔"));
  assert.equal(translateCustomerText("TÂM AN CENTER", language), "TÂM AN CENTER");
  assert.equal(translateCustomerText("Tây Hồ", language), "Tây Hồ");
}

console.log(`✓ English and Simplified Chinese cover ${CUSTOMER_TRANSLATION_SOURCE_KEYS.length} customer copy entries and all critical dynamic flows.`);
