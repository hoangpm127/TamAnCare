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
  'setting_booking_auto_confirm',
  'booking.auto_confirm',
  'GLOBAL:booking.auto_confirm',
  'BOOKING',
  'AI tự động xác nhận & điều phối',
  'true',
  'BOOLEAN',
  'Sau khi khoản cọc được đối soát, hệ thống tự xác nhận lịch, giữ giường/phòng và điều phối KTV phù hợp. Có thể chuyển sang xác nhận thủ công khi cần.',
  true
)
ON CONFLICT ("scopeKey") DO NOTHING;
