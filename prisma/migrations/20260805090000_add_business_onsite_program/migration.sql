-- Add an immutable operational snapshot to each Business event and install the
-- owner-approved onsite program. Existing customers, bookings and payments are
-- preserved.
ALTER TABLE "OfficeEvent"
  ADD COLUMN "onsiteAssets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "returnVoucherCode" TEXT;

INSERT INTO "SystemSetting" (
  "id", "key", "scopeKey", "category", "label", "value", "valueType",
  "description", "branchId", "isActive", "createdAt", "updatedAt"
)
VALUES
  (
    'setting-business-onsite-program',
    'business.onsite_program',
    'GLOBAL:business.onsite_program',
    'BUSINESS',
    'Chương trình onsite văn phòng',
    '{"deploymentEnabled":true,"priorityArea":"Tây Hồ và khu vực nội thành Hà Nội","durationOptionsMin":[10,15,20,30],"priceOptions":[0,29000,59000,89000,129000],"customPriceAllowed":true,"minimumTherapistsPerSession":5,"requiredAssets":["Ghế chuyên dụng","Khăn sạch","Standee QR","Tinh dầu","Đồng phục","Voucher tại cơ sở"],"returnVoucher":{"code":"RETURN100","amount":100000,"description":"Tặng 100.000đ khi khách quay lại Tâm An Center từ ngày 7 đến ngày 30."},"pilotPolicy":"Buổi pilot miễn phí chỉ áp dụng sau khi Tâm An Center xác nhận chương trình với doanh nghiệp."}',
    'JSON',
    'Thời lượng, khung giá tư vấn, đội KTV, vật tư và voucher kéo khách về cơ sở.',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'setting-business-onsite-trials-v153',
    'business.trial_packages',
    'GLOBAL:business.trial_packages',
    'BUSINESS',
    'Gói onsite Business',
    '[{"id":"onsite-10","durationMin":10,"pricePerPerson":29000,"name":"Onsite khởi động 10 phút","description":"Thả lỏng nhanh vùng cổ - vai - gáy ngay tại văn phòng."},{"id":"onsite-15","durationMin":15,"pricePerPerson":59000,"name":"Onsite nhanh 15 phút","description":"Bấm huyệt cổ - vai - gáy gọn trong giờ nghỉ trưa."},{"id":"onsite-20","durationMin":20,"pricePerPerson":89000,"name":"Onsite tiêu chuẩn 20 phút","description":"Massage cổ vai gáy kết hợp bấm huyệt đầu cho dân văn phòng."},{"id":"onsite-30","durationMin":30,"pricePerPerson":129000,"name":"Onsite chuyên sâu 30 phút","description":"Chăm sóc lưng - vai - gáy chuyên sâu trên ghế chuyên dụng."}]',
    'JSON',
    'Bảng giá tự động cho bốn thời lượng onsite đã được duyệt.',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("scopeKey") DO UPDATE SET
  "category" = EXCLUDED."category",
  "label" = EXCLUDED."label",
  "value" = EXCLUDED."value",
  "valueType" = EXCLUDED."valueType",
  "description" = EXCLUDED."description",
  "branchId" = EXCLUDED."branchId",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Existing upcoming events inherit the new operational checklist without
-- changing any historical price, Bill or payment record.
UPDATE "OfficeEvent"
SET
  "onsiteAssets" = ARRAY['Ghế chuyên dụng', 'Khăn sạch', 'Standee QR', 'Tinh dầu', 'Đồng phục', 'Voucher tại cơ sở']::TEXT[],
  "returnVoucherCode" = 'RETURN100',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('AWAITING_DEPOSIT', 'DEPOSIT_CONFIRMED', 'READY')
  AND cardinality("onsiteAssets") = 0;
