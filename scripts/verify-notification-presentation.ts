import assert from "node:assert/strict";
import { NOTIFICATION_TONE_STYLES, notificationTone, presentNotification, simplifyNotificationText } from "../lib/notification-presentation";

assert.equal(notificationTone("Dịch vụ và thanh toán đã hoàn tất", "Cảm ơn bạn."), "SUCCESS");
assert.equal(notificationTone("Đã tạo yêu cầu cọc · Chờ đối soát", "Vui lòng chuyển khoản."), "PENDING");
assert.equal(notificationTone("Giao dịch ngân hàng chưa khớp booking", "Cần đối soát thủ công."), "ATTENTION");
assert.equal(notificationTone("Cơ hội đầu tư mới", "Hồ sơ vừa được cập nhật."), "INFO");

assert.equal(simplifyNotificationText("AI vừa điều phối booking mới"), "Hệ thống sắp lịch vừa sắp xếp lịch hẹn mới");
assert.equal(simplifyNotificationText("Chờ đối soát cọc và đóng Bill"), "Chờ xác nhận tiền cọc và hoàn tất hóa đơn");
assert.equal(simplifyNotificationText("Tip KTV · GMV Business"), "Tip kỹ thuật viên · doanh thu Business");
assert.equal(simplifyNotificationText("Khách đã check-in · chờ đóng Bill"), "Khách đã đến · chờ hoàn tất hóa đơn");

assert.match(NOTIFICATION_TONE_STYLES.SUCCESS.card, /emerald/);
assert.match(NOTIFICATION_TONE_STYLES.PENDING.card, /amber/);
assert.match(NOTIFICATION_TONE_STYLES.ATTENTION.card, /rose/);
assert.match(NOTIFICATION_TONE_STYLES.INFO.card, /sky/);

const completed = presentNotification("Bill đã hoàn tất", "Đã đối soát thanh toán đủ.");
assert.equal(completed.label, "Đã hoàn tất");
assert.equal(completed.title, "Hóa đơn đã hoàn tất");
assert.equal(completed.body, "Đã xác nhận thanh toán đủ.");

console.log("✓ Ngôn ngữ và màu trạng thái thông báo đã được phân loại nhất quán.");
