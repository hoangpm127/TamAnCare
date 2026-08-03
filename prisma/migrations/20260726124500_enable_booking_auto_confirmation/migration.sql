INSERT INTO "SystemSetting" (
  "id",
  "key",
  "scopeKey",
  "category",
  "label",
  "value",
  "valueType",
  "description",
  "isActive"
) VALUES (
  'setting_booking_auto_confirm_live',
  'booking.auto_confirm',
  'GLOBAL:booking.auto_confirm',
  'BOOKING',
  'AI tự động xác nhận & điều phối',
  'true',
  'BOOLEAN',
  'Sau khi SePay đối soát cọc, hệ thống tự xác nhận lịch và điều phối tài nguyên phù hợp.',
  true
)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "value" = 'true',
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "SystemSetting"
SET
  "value" = 'true',
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'booking.auto_confirm';
