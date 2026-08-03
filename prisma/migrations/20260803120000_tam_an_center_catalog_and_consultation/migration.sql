-- Record the one-time free consultation choice for newly-created customer accounts.
CREATE TYPE "FreeConsultationDecision" AS ENUM ('INTERESTED', 'DECLINED');

ALTER TABLE "CustomerAccount"
  ADD COLUMN "freeConsultationEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "freeConsultationDecision" "FreeConsultationDecision",
  ADD COLUMN "freeConsultationPreferredTime" TEXT,
  ADD COLUMN "freeConsultationRespondedAt" TIMESTAMP(3);

-- Rebrand persisted display text without deleting operational history.
UPDATE "Branch"
SET
  "name" = REPLACE("name", 'Tâm An Care', 'Tâm An Center'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" LIKE '%Tâm An Care%';

UPDATE "Therapist"
SET
  "publicBio" = REPLACE("publicBio", 'Tâm An Care', 'Tâm An Center'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "publicBio" LIKE '%Tâm An Care%';

-- Official location published by Tâm An Center. A one-seat default avoids
-- advertising unverified capacity; real rooms and therapists remain required.
INSERT INTO "Branch" (
  "id", "name", "address", "phone", "openTime", "closeTime",
  "lastBookingTime", "seatCapacity", "bufferMinutes", "createdAt", "updatedAt"
)
SELECT
  'tam-an-center-tay-ho',
  'Tâm An Center · Tây Hồ',
  'Số 34 Khu phố An Sinh, O16-CT2 Khu đô thị mới Tây Hồ, phường Nghĩa Đô, TP. Hà Nội',
  '0963039273',
  '08:00',
  '22:00',
  '21:00',
  1,
  15,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Branch"
  WHERE "id" = 'tam-an-center-tay-ho'
     OR "address" = 'Số 34 Khu phố An Sinh, O16-CT2 Khu đô thị mới Tây Hồ, phường Nghĩa Đô, TP. Hà Nội'
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Branch"
SET
  "name" = 'Tâm An Center · Tây Hồ',
  "address" = 'Số 34 Khu phố An Sinh, O16-CT2 Khu đô thị mới Tây Hồ, phường Nghĩa Đô, TP. Hà Nội',
  "phone" = '0963039273',
  "openTime" = '08:00',
  "closeTime" = '22:00',
  "lastBookingTime" = '21:00',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tam-an-center-tay-ho'
   OR "address" = 'Số 34 Khu phố An Sinh, O16-CT2 Khu đô thị mới Tây Hồ, phường Nghĩa Đô, TP. Hà Nội';

-- Retire only the cloned demo catalog. Existing bookings and financial records
-- remain intact; matching official services below are re-enabled in-place.
UPDATE "Service"
SET "isActive" = false, "isOnline" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN (
  'foot-massage-60', 'foot-massage-90', 'foot-massage-120',
  'body-massage-60', 'body-massage-90', 'body-massage-120',
  'giac-hoi', 'goi-dau-duong-sinh', 'vai-gay-chuyen-sau-60',
  'body-chuyen-sau-90', 'tam-an-lunch-reset-15', 'tam-an-lunch-reset-20'
);

INSERT INTO "Service" (
  "id", "name", "slug", "description", "category", "durationMin",
  "basePrice", "therapistFee", "isActive", "isOnline", "sortOrder", "createdAt", "updatedAt"
)
VALUES
  ('svc-body-60', 'Massage Body 60 phút', 'body-massage-60', 'Chăm sóc toàn thân giúp thư giãn cơ bắp, giảm căng thẳng và hỗ trợ phục hồi năng lượng.', 'BODY', 60, 450000, 0, true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-body-90', 'Massage Body 90 phút', 'body-massage-90', 'Thời lượng mở rộng để chăm sóc kỹ các vùng cơ căng mỏi và thư giãn toàn thân.', 'BODY', 90, 790000, 0, true, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-body-120', 'Massage Body 120 phút', 'body-massage-120', 'Liệu trình toàn thân chuyên sâu với thời gian nghỉ ngơi và chăm sóc dài hơn.', 'BODY', 120, 990000, 0, true, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-neck-60', 'Massage Cổ Vai Gáy 60 phút', 'massage-co-vai-gay-60', 'Tập trung vùng cổ, vai, gáy để hỗ trợ giảm co cứng và cảm giác nhức mỏi do ngồi lâu hoặc vận động sai tư thế.', 'NECK_SHOULDER', 60, 390000, 0, true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-neck-90', 'Massage Cổ Vai Gáy 90 phút', 'massage-co-vai-gay-90', 'Chăm sóc kéo dài cho vùng cổ vai gáy và các nhóm cơ liên quan, phù hợp khi cần thư giãn sâu hơn.', 'NECK_SHOULDER', 90, 750000, 0, true, true, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-foot-60', 'Massage Chân 60 phút', 'foot-massage-60', 'Thư giãn bàn chân, bắp chân và hỗ trợ giảm mỏi sau khi đứng, đi lại hoặc vận động nhiều.', 'FOOT', 60, 350000, 0, true, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-foot-90', 'Massage Chân 90 phút', 'foot-massage-90', 'Chăm sóc bàn chân và cẳng chân kỹ hơn với thời lượng nghỉ ngơi mở rộng.', 'FOOT', 90, 650000, 0, true, true, 31, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-back-60', 'Massage Lưng Hông 60 phút', 'massage-lung-hong-60', 'Tập trung vùng lưng và hông, hỗ trợ thư giãn các nhóm cơ chịu áp lực khi ngồi lâu hoặc vận động nhiều.', 'THERAPY', 60, 390000, 0, true, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-back-90', 'Massage Lưng Hông 90 phút', 'massage-lung-hong-90', 'Chăm sóc chuyên sâu vùng lưng hông trong thời lượng dài hơn, điều chỉnh theo tình trạng thực tế.', 'THERAPY', 90, 750000, 0, true, true, 41, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-belly-45', 'Massage Bụng 45 phút', 'massage-bung-45', 'Chăm sóc vùng bụng bằng thao tác phù hợp, hướng tới thư giãn và cảm giác dễ chịu.', 'BODY', 45, 350000, 0, true, true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-head-energy-45', 'Bổ Sung Năng Lượng Đầu 45 phút', 'bo-sung-nang-luong-dau-45', 'Chăm sóc vùng đầu giúp thư giãn tinh thần, giải tỏa cảm giác căng thẳng và mệt mỏi.', 'HEAD_SPA', 45, 450000, 0, true, true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-hot-herbal', 'Chườm Ngải Nóng, Thảo Dược', 'chuom-ngai-nong-thao-duoc', 'Chườm ấm bằng ngải và thảo dược; thời lượng dự kiến 30 phút và được xác nhận theo liệu trình thực tế.', 'THERAPY', 30, 250000, 0, true, true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-mugwort-mud', 'Đắp Bùn Ngải', 'dap-bun-ngai', 'Chăm sóc bằng bùn ngải; thời lượng dự kiến 30 phút và được xác nhận theo liệu trình thực tế.', 'THERAPY', 30, 150000, 0, true, true, 71, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-hot-stone', 'Chườm Đá Nóng', 'chuom-da-nong', 'Sử dụng nhiệt ấm từ đá để hỗ trợ thư giãn cơ; thời lượng dự kiến 30 phút và xác nhận theo liệu trình.', 'THERAPY', 30, 80000, 0, true, true, 72, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-cupping', 'Cạo Gió Giác Hơi', 'giac-hoi', 'Cạo gió và giác hơi theo đánh giá tình trạng cơ thể; khung lịch dự kiến 30 phút.', 'THERAPY', 30, 150000, 0, true, true, 73, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-steam-15', 'Xông Hơi 15 phút', 'xong-hoi-15', 'Xông hơi trong thời lượng ngắn để làm ấm cơ thể và hỗ trợ thư giãn trước hoặc sau dịch vụ.', 'THERAPY', 15, 150000, 0, true, true, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "durationMin" = EXCLUDED."durationMin",
  "basePrice" = EXCLUDED."basePrice",
  "therapistFee" = EXCLUDED."therapistFee",
  "isActive" = EXCLUDED."isActive",
  "isOnline" = EXCLUDED."isOnline",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
