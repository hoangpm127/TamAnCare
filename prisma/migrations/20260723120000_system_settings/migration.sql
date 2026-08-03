-- Persistent operating settings used by Admin and branch managers.
CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "valueType" TEXT NOT NULL DEFAULT 'TEXT',
  "description" TEXT,
  "branchId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemSetting_scopeKey_key" ON "SystemSetting"("scopeKey");
CREATE INDEX "SystemSetting_category_isActive_idx" ON "SystemSetting"("category", "isActive");
CREATE INDEX "SystemSetting_branchId_category_idx" ON "SystemSetting"("branchId", "category");

INSERT INTO "SystemSetting" ("id", "key", "scopeKey", "category", "label", "value", "valueType", "description") VALUES
('setting_chat_enabled', 'assistant.enabled', 'GLOBAL:assistant.enabled', 'CHAT', 'Trợ lý chat khách hàng', 'true', 'BOOLEAN', 'Bật hoặc tắt trợ lý chat trên toàn hệ thống.'),
('setting_chat_tone', 'assistant.tone', 'GLOBAL:assistant.tone', 'CHAT', 'Phong cách phản hồi', 'Tận tâm, ngắn gọn, lịch thiệp', 'TEXT', 'Quy chuẩn giọng điệu dùng khi tư vấn khách.'),
('setting_chat_handoff', 'assistant.handoff_minutes', 'GLOBAL:assistant.handoff_minutes', 'CHAT', 'Chuyển lễ tân sau', '3', 'NUMBER', 'Số phút không xử lý được trước khi chuyển cho người thật.'),
('setting_booking_deposit', 'booking.deposit_percent', 'GLOBAL:booking.deposit_percent', 'BOOKING', 'Tỷ lệ đặt cọc', '10', 'PERCENT', 'Tính trên tổng Bill sau ưu đãi.'),
('setting_booking_reschedule', 'booking.free_reschedule_monthly', 'GLOBAL:booking.free_reschedule_monthly', 'BOOKING', 'Đổi lịch miễn phí mỗi tháng', '1', 'NUMBER', 'Từ lần tiếp theo trong tháng áp dụng chính sách cọc.'),
('setting_booking_last_slot', 'booking.last_slot_duration', 'GLOBAL:booking.last_slot_duration', 'BOOKING', 'Thời lượng ca cuối', '60', 'MINUTES', 'Ca 23:00 chỉ nhận dịch vụ 60 phút.'),
('setting_notify_confirm', 'notification.booking_confirmation', 'GLOBAL:notification.booking_confirmation', 'NOTIFICATION', 'Thông báo xác nhận lịch', 'true', 'BOOLEAN', 'Gửi ngay cho khách khi cơ sở chấp nhận hoặc từ chối lịch.'),
('setting_notify_checkin', 'notification.service_timeline', 'GLOBAL:notification.service_timeline', 'NOTIFICATION', 'Thông báo tiến trình dịch vụ', 'true', 'BOOLEAN', 'Thông báo các mốc check-in, bắt đầu và check-out.'),
('setting_finance_tip', 'finance.tip_payout_time', 'GLOBAL:finance.tip_payout_time', 'FINANCE', 'Giờ chi Tip KTV', '23:59', 'TIME', 'Tip KTV nằm ngoài Bill dịch vụ và được đối soát cuối ngày.'),
('setting_finance_ai_bill', 'finance.ai_bill_review', 'GLOBAL:finance.ai_bill_review', 'FINANCE', 'AI nhận diện ảnh Bill', 'true', 'BOOLEAN', 'Yêu cầu đối soát ảnh chứng từ trước khi ghi nhận đã chi.'),
('setting_security_mfa', 'security.management_mfa', 'GLOBAL:security.management_mfa', 'SECURITY', 'MFA cho quản lý', 'true', 'BOOLEAN', 'Bắt buộc xác thực hai bước với Chủ và Quản lý cơ sở.'),
('setting_security_session', 'security.session_days', 'GLOBAL:security.session_days', 'SECURITY', 'Thời hạn phiên quản trị', '7', 'DAYS', 'Số ngày tối đa của một phiên đăng nhập quản trị.');

-- Repair known UAT display-name corruption so future audit and notification text is clean.
UPDATE "User" SET "name" = CASE "username"
  WHEN 'admin' THEN 'Admin Tâm An'
  WHEN 'quanlycs1' THEN 'Quản lý Cơ sở 1'
  WHEN 'quanlycs2' THEN 'Quản lý Cơ sở 2'
  WHEN 'letancs1' THEN 'Lễ tân Cơ sở 1'
  WHEN 'letancs2' THEN 'Lễ tân Cơ sở 2'
  WHEN 'ktvcs1' THEN 'KTV Cơ sở 1'
  WHEN 'ktvcs2' THEN 'KTV Cơ sở 2'
  WHEN 'nhadaututaman' THEN 'Nhà đầu tư Tâm An'
  ELSE "name"
END
WHERE "username" IN ('admin', 'quanlycs1', 'quanlycs2', 'letancs1', 'letancs2', 'ktvcs1', 'ktvcs2', 'nhadaututaman');

UPDATE "Notification"
SET "body" = replace("body", 'Ch? Tu? T?m ? UAT', 'Admin Tâm An')
WHERE "body" LIKE '%Ch? Tu? T?m ? UAT%';
