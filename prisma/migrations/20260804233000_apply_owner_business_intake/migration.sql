-- Apply the 04/08/2026 owner business intake without deleting customers,
-- bookings, payments, ledger history, or previously sold packages.

ALTER TABLE "Service"
  ADD COLUMN "suggestedTip" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Voucher"
  ADD COLUMN "validAfterDaysAfterLastVisit" INTEGER;

ALTER TABLE "CustomerPackage"
  ADD COLUMN "campaignId" TEXT;

ALTER TABLE "CustomerAccount"
  ADD COLUMN "affiliateArea" TEXT,
  ADD COLUMN "affiliateBankName" TEXT,
  ADD COLUMN "affiliateBankAccount" TEXT,
  ADD COLUMN "affiliateBankHolder" TEXT;

ALTER TABLE "CustomerAccount"
  ALTER COLUMN "creditBalance" SET DEFAULT 150000;

CREATE INDEX "CustomerPackage_campaignId_createdAt_idx"
  ON "CustomerPackage"("campaignId", "createdAt");

ALTER TABLE "CustomerPackage"
  ADD CONSTRAINT "CustomerPackage_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Branch 1: six massage rooms/beds, 09:00-21:00, five-minute turnover.
UPDATE "Branch"
SET
  "name" = 'Tâm An Center · Tây Hồ',
  "address" = 'Số 34 Khu phố An Sinh, khu đô thị mới Tây Hồ, phường Nghĩa Đô, Hà Nội',
  "phone" = '0963039273',
  "openTime" = '09:00',
  "closeTime" = '21:00',
  "lastBookingTime" = '20:45',
  "seatCapacity" = 6,
  "bufferMinutes" = 5,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tam-an-center-tay-ho';

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "note", "createdAt", "updatedAt"
)
SELECT
  format('tam-an-center-tay-ho-seat-%s', lpad(room_number::text, 2, '0')),
  'tam-an-center-tay-ho',
  format('Phòng massage %s', lpad(room_number::text, 2, '0')),
  'MASSAGE_BED'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY[
    'BODY'::"ServiceCategory", 'FOOT'::"ServiceCategory",
    'NECK_SHOULDER'::"ServiceCategory", 'HEAD_SPA'::"ServiceCategory",
    'THERAPY'::"ServiceCategory", 'COMBO'::"ServiceCategory"
  ],
  'Một phòng với một giường massage theo phiếu nghiệp vụ chủ cơ sở ngày 04/08/2026.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM generate_series(1, 6) AS room_number
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Room"
SET
  "status" = 'HIDDEN'::"RoomStatus",
  "note" = 'Tạm ẩn theo công suất 6 phòng/6 giường; giữ nguyên lịch sử và booking đã có.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "branchId" = 'tam-an-center-tay-ho'
  AND "id" NOT IN (
    'tam-an-center-tay-ho-seat-01', 'tam-an-center-tay-ho-seat-02',
    'tam-an-center-tay-ho-seat-03', 'tam-an-center-tay-ho-seat-04',
    'tam-an-center-tay-ho-seat-05', 'tam-an-center-tay-ho-seat-06'
  );

-- Retire only customer-facing non-office services. History remains linked.
UPDATE "Service"
SET "isActive" = false, "isOnline" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "category" <> 'OFFICE'::"ServiceCategory";

INSERT INTO "Service" (
  "id", "name", "slug", "description", "category", "durationMin",
  "basePrice", "therapistFee", "suggestedTip", "isActive", "isOnline",
  "sortOrder", "createdAt", "updatedAt"
)
VALUES
  ('svc-body-60', 'Massage Body 60 phút', 'body-massage-60', 'Chăm sóc toàn thân giúp thư giãn cơ bắp và phục hồi năng lượng.', 'BODY', 60, 450000, 0, 80000, true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-body-90', 'Massage Body 90 phút', 'body-massage-90', 'Chăm sóc toàn thân với thời lượng mở rộng cho các vùng cơ căng mỏi.', 'BODY', 90, 650000, 0, 120000, true, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-body-120', 'Massage Body 120 phút', 'body-massage-120', 'Liệu trình toàn thân dài hơn, phù hợp nhu cầu thư giãn sâu.', 'BODY', 120, 790000, 0, 160000, true, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('svc-foot-60', 'Massage Chân 60 phút', 'foot-massage-60', 'Thư giãn bàn chân và cẳng chân sau khi đứng, đi lại hoặc vận động nhiều.', 'FOOT', 60, 350000, 0, 60000, true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-foot-90', 'Massage Chân 90 phút', 'foot-massage-90', 'Chăm sóc bàn chân và cẳng chân kỹ hơn với thời lượng mở rộng.', 'FOOT', 90, 490000, 0, 90000, true, true, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-foot-120', 'Massage Chân 120 phút', 'foot-massage-120', 'Liệu trình chăm sóc chân dài hơn cho nhu cầu thư giãn chuyên sâu.', 'FOOT', 120, 610000, 0, 120000, true, true, 22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('svc-neck-60', 'Massage Cổ Vai Gáy 60 phút', 'massage-co-vai-gay-60', 'Tập trung vùng cổ, vai và gáy để hỗ trợ thư giãn cảm giác căng mỏi.', 'NECK_SHOULDER', 60, 390000, 0, 70000, true, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-neck-90', 'Massage Cổ Vai Gáy 90 phút', 'massage-co-vai-gay-90', 'Chăm sóc kéo dài cho vùng cổ vai gáy và các nhóm cơ liên quan.', 'NECK_SHOULDER', 90, 510000, 0, 105000, true, true, 31, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-neck-120', 'Massage Cổ Vai Gáy 120 phút', 'massage-co-vai-gay-120', 'Liệu trình cổ vai gáy dài hơn, điều chỉnh theo cảm nhận thực tế của khách.', 'NECK_SHOULDER', 120, 650000, 0, 140000, true, true, 32, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('svc-cupping', 'Cạo Gió + Giác Hơi 30 phút', 'giac-hoi', 'Cạo gió và giác hơi theo đánh giá tình trạng cơ thể; khách cần trao đổi trước với chuyên viên.', 'THERAPY', 30, 150000, 0, 30000, true, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('svc-head-energy-45', 'Thải Độc - Bổ Sung Năng Lượng Vùng Đầu 60 phút', 'bo-sung-nang-luong-dau-45', 'Chăm sóc vùng đầu giúp thư giãn tinh thần và giảm cảm giác căng thẳng.', 'HEAD_SPA', 60, 450000, 0, 80000, true, true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-head-energy-90', 'Thải Độc - Bổ Sung Năng Lượng Vùng Đầu 90 phút', 'bo-sung-nang-luong-dau-90', 'Chăm sóc vùng đầu với thời lượng mở rộng và nhịp thư giãn sâu hơn.', 'HEAD_SPA', 90, 650000, 0, 120000, true, true, 51, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-head-energy-120', 'Thải Độc - Bổ Sung Năng Lượng Vùng Đầu 120 phút', 'bo-sung-nang-luong-dau-120', 'Liệu trình vùng đầu dài hơn, điều chỉnh theo nhu cầu thư giãn của khách.', 'HEAD_SPA', 120, 790000, 0, 160000, true, true, 52, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('svc-steam-15', 'Xông Hơi 15 phút', 'xong-hoi-15', 'Xông hơi trong thời lượng ngắn để làm ấm cơ thể và hỗ trợ thư giãn.', 'THERAPY', 15, 150000, 0, 0, true, true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc-expert-consult-15', 'Thăm Khám Cơ Xương Khớp Với Chuyên Gia 15 phút', 'tham-kham-co-xuong-khop-chuyen-gia-15', 'Chuyên gia đánh giá ban đầu các triệu chứng cơ xương khớp và gợi ý hướng chăm sóc; không thay thế chẩn đoán hoặc điều trị y khoa.', 'THERAPY', 15, 300000, 0, 100000, true, true, 61, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "durationMin" = EXCLUDED."durationMin",
  "basePrice" = EXCLUDED."basePrice",
  "therapistFee" = 0,
  "suggestedTip" = EXCLUDED."suggestedTip",
  "isActive" = true,
  "isOnline" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

-- The current named team replaces the provisional public profiles. Old rows
-- stay attached to any historical bookings but are no longer bookable.
UPDATE "Therapist"
SET "status" = 'HIDDEN'::"TherapistStatus", "onlineBooking" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'tam-an-ktv-huong-lan', 'tam-an-ktv-thu-hoai', 'tam-an-ktv-thanh-hoa',
  'tam-an-ktv-ngoc-tram', 'tam-an-ktv-phuong-linh'
);

INSERT INTO "Therapist" (
  "id", "branchId", "fullName", "gender", "skills", "shiftLabel", "status",
  "onlineBooking", "ratingAvg", "servedCount", "repeatCount", "publicBio",
  "publicStrengths", "profileApprovalStatus", "profileReviewedAt", "internalNote",
  "createdAt", "updatedAt"
)
VALUES
  ('tam-an-ktv-nguyen-huy', 'tam-an-center-tay-ho', 'Nguyễn Huy', NULL,
   ARRAY['Massage Body', 'Massage Chân', 'Cổ vai gáy', 'Chăm sóc vùng đầu', 'Onsite']::TEXT[],
   '09:00-18:00', 'ACTIVE', true, 5, 0, 0,
   'KTV đa kỹ năng, nhận các dịch vụ Body, chân, cổ vai gáy, vùng đầu và chương trình onsite.',
   ARRAY['Đa kỹ năng', 'Onsite', 'Ca 09:00-18:00']::TEXT[], 'APPROVED', CURRENT_TIMESTAMP,
   'Hồ sơ cập nhật theo phiếu nghiệp vụ chủ cơ sở ngày 04/08/2026.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tam-an-ktv-thu-thao', 'tam-an-center-tay-ho', 'Thu Thảo', NULL,
   ARRAY['Massage Body', 'Massage Chân', 'Cổ vai gáy', 'Chăm sóc vùng đầu', 'Onsite']::TEXT[],
   '09:00-21:00', 'ACTIVE', true, 5, 0, 0,
   'KTV đa kỹ năng, làm việc xuyên suốt khung giờ mở cửa và nhận chương trình onsite.',
   ARRAY['Đa kỹ năng', 'Onsite', 'Ca 09:00-21:00']::TEXT[], 'APPROVED', CURRENT_TIMESTAMP,
   'Hồ sơ cập nhật theo phiếu nghiệp vụ chủ cơ sở ngày 04/08/2026.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tam-an-chuyen-gia-nguyen-van-son', 'tam-an-center-tay-ho', 'Nguyễn Văn Sơn', NULL,
   ARRAY['Thăm khám ban đầu', 'Massage Body', 'Massage Chân', 'Cổ vai gáy', 'Chăm sóc vùng đầu', 'Onsite']::TEXT[],
   '09:00-21:00', 'ACTIVE', true, 5, 0, 0,
   'Chuyên gia thăm khám ban đầu kiêm KTV, hỗ trợ đánh giá nhu cầu và gợi ý hướng chăm sóc phù hợp.',
   ARRAY['Chuyên gia thăm khám', 'Đa kỹ năng', 'Onsite']::TEXT[], 'APPROVED', CURRENT_TIMESTAMP,
   'Hồ sơ cập nhật theo phiếu nghiệp vụ chủ cơ sở ngày 04/08/2026.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tam-an-ktv-nguyen-van-anh', 'tam-an-center-tay-ho', 'Nguyễn Văn Anh', NULL,
   ARRAY['KTV Tâm An Center']::TEXT[], 'Theo lịch cơ sở', 'ACTIVE', false, 5, 0, 0,
   'KTV của Tâm An Center; lịch nhận khách và chuyên môn công khai đang chờ chủ cơ sở xác nhận.',
   ARRAY['Hồ sơ đang hoàn thiện']::TEXT[], 'APPROVED', CURRENT_TIMESTAMP,
   'Chưa bật đặt online vì phiếu nghiệp vụ chưa điền kỹ năng, ca làm và quyền cho khách chọn.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId", "fullName" = EXCLUDED."fullName",
  "skills" = EXCLUDED."skills", "shiftLabel" = EXCLUDED."shiftLabel",
  "status" = EXCLUDED."status", "onlineBooking" = EXCLUDED."onlineBooking",
  "publicBio" = EXCLUDED."publicBio", "publicStrengths" = EXCLUDED."publicStrengths",
  "profileApprovalStatus" = EXCLUDED."profileApprovalStatus",
  "profileReviewedAt" = EXCLUDED."profileReviewedAt", "internalNote" = EXCLUDED."internalNote",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "_ServiceToTherapist" ("A", "B")
SELECT service."id", therapist."id"
FROM "Service" service
CROSS JOIN "Therapist" therapist
WHERE service."isActive" = true
  AND service."isOnline" = true
  AND service."category" <> 'OFFICE'::"ServiceCategory"
  AND therapist."id" IN (
    'tam-an-ktv-nguyen-huy', 'tam-an-ktv-thu-thao', 'tam-an-chuyen-gia-nguyen-van-son'
  )
ON CONFLICT ("A", "B") DO NOTHING;

-- Three owner-approved long-term Body plans. Historical plans are retained.
UPDATE "PackagePlan"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "PackagePlan"
SET "name" = 'Gói Body 3 buổi', "serviceId" = 'svc-body-60', "sessions" = 3,
    "paidSessions" = 3, "bonusSessions" = 0, "validityDays" = 30,
    "price" = 1200000, "badge" = 'Tiết kiệm 150K', "isHighlighted" = false,
    "isActive" = true, "shareable" = false, "transferable" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-3';

UPDATE "PackagePlan"
SET "name" = 'Gói Body 5 buổi', "serviceId" = 'svc-body-60', "sessions" = 5,
    "paidSessions" = 5, "bonusSessions" = 0, "validityDays" = 60,
    "price" = 1900000, "badge" = 'Tiết kiệm 350K', "isHighlighted" = true,
    "isActive" = true, "shareable" = false, "transferable" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-5';

UPDATE "PackagePlan"
SET "name" = 'Gói Body 10 buổi', "serviceId" = 'svc-body-60', "sessions" = 10,
    "paidSessions" = 10, "bonusSessions" = 0, "validityDays" = 90,
    "price" = 3500000, "badge" = 'Tiết kiệm 1 triệu', "isHighlighted" = true,
    "isActive" = true, "shareable" = false, "transferable" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-9';

-- Customer offers from the intake: 150K welcome, Body 279K off-peak,
-- and a 100K return voucher available from day 7 to day 30.
UPDATE "Voucher"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('WELCOME100', 'FIRST60', 'SANG70', 'RETURN7');

INSERT INTO "Voucher" (
  "id", "code", "name", "description", "discountType", "discountValue",
  "minimumSpend", "maximumDiscount", "displayConstraint", "accentColor",
  "firstVisitOnly", "requiresAccount", "requiresVerifiedPhone",
  "minimumServiceDurationMin", "bookingStartMinuteMin", "bookingStartMinuteMax",
  "excludeWeekend", "validWithinDaysAfterLastVisit", "validAfterDaysAfterLastVisit",
  "maxUsage", "maxPerCustomer", "startsAt", "endsAt", "isActive", "serviceId",
  "createdAt", "updatedAt"
)
VALUES
  ('voucher-tam-an-welcome150', 'WELCOME150', 'Thành viên mới nhận 150K',
   'Tặng 150.000đ cho lần đặt dịch vụ đầu tiên sau khi tạo tài khoản và xác minh số điện thoại.',
   'FIXED', 150000, 350000, NULL, 'Mỗi khách một lần · xác định bằng số điện thoại/Zalo/tài khoản', '#b4232b',
   true, true, true, NULL, NULL, NULL, false, NULL, NULL, 1000, 1,
   NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('voucher-tam-an-body279', 'BODY279', 'Body giờ rảnh 279K',
   'Giá trải nghiệm Massage Body 60 phút còn 279.000đ cho lịch bắt đầu từ 10:00 đến 14:00.',
   'FIXED', 171000, 450000, 171000, 'Body 60 phút · bắt đầu 10:00-14:00', '#b86b1f',
   false, true, true, 60, 600, 840, false, NULL, NULL, 500, 1,
   NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, 'svc-body-60', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('voucher-tam-an-return100', 'RETURN100', 'Quay lại nhận 100K',
   'Tặng 100.000đ khi khách quay lại từ ngày thứ 7 sau lần sử dụng gần nhất.',
   'FIXED', 100000, 350000, 100000, 'Từ ngày 7 đến ngày 30 sau lần ghé gần nhất', '#8f241d',
   false, true, true, NULL, NULL, NULL, false, 30, 7, 1000, 1,
   NULL, CURRENT_TIMESTAMP + INTERVAL '365 days', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "discountType" = EXCLUDED."discountType", "discountValue" = EXCLUDED."discountValue",
  "minimumSpend" = EXCLUDED."minimumSpend", "maximumDiscount" = EXCLUDED."maximumDiscount",
  "displayConstraint" = EXCLUDED."displayConstraint", "accentColor" = EXCLUDED."accentColor",
  "firstVisitOnly" = EXCLUDED."firstVisitOnly", "requiresAccount" = EXCLUDED."requiresAccount",
  "requiresVerifiedPhone" = EXCLUDED."requiresVerifiedPhone",
  "minimumServiceDurationMin" = EXCLUDED."minimumServiceDurationMin",
  "bookingStartMinuteMin" = EXCLUDED."bookingStartMinuteMin",
  "bookingStartMinuteMax" = EXCLUDED."bookingStartMinuteMax",
  "excludeWeekend" = EXCLUDED."excludeWeekend",
  "validWithinDaysAfterLastVisit" = EXCLUDED."validWithinDaysAfterLastVisit",
  "validAfterDaysAfterLastVisit" = EXCLUDED."validAfterDaysAfterLastVisit",
  "maxUsage" = EXCLUDED."maxUsage", "maxPerCustomer" = EXCLUDED."maxPerCustomer",
  "startsAt" = EXCLUDED."startsAt", "endsAt" = EXCLUDED."endsAt",
  "isActive" = true, "serviceId" = EXCLUDED."serviceId", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "CustomerAccount" account
SET "creditBalance" = 150000, "updatedAt" = CURRENT_TIMESTAMP
FROM "Customer" customer
WHERE customer."id" = account."customerId"
  AND customer."totalVisits" = 0
  AND account."creditBalance" = 100000;

UPDATE "Campaign"
SET "manualCost" = 0, "updatedAt" = CURRENT_TIMESTAMP
WHERE "source" LIKE 'AFFILIATE:%';

INSERT INTO "SystemSetting" (
  "id", "key", "scopeKey", "category", "label", "value", "valueType",
  "description", "branchId", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('setting-taman-slogan', 'brand.slogan', 'GLOBAL:brand.slogan', 'BRAND', 'Slogan', 'Chạm sóc toàn diện, nâng niu từng cảm giác', 'TEXT', 'Slogan theo phiếu nghiệp vụ chủ cơ sở.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-website', 'brand.website', 'GLOBAL:brand.website', 'BRAND', 'Website chính thức', 'https://tamancenter.com/', 'TEXT', 'Website do chủ cơ sở cung cấp.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-facebook', 'brand.facebook', 'GLOBAL:brand.facebook', 'BRAND', 'Facebook', 'Tâm An Center Spa & Massage', 'TEXT', 'Tên trang Facebook do chủ cơ sở cung cấp.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-tiktok', 'brand.tiktok', 'GLOBAL:brand.tiktok', 'BRAND', 'TikTok', 'Tâm An Spa & Massage', 'TEXT', 'Tên kênh TikTok do chủ cơ sở cung cấp.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-proposed-branch', 'operations.proposed_branch_2', 'GLOBAL:operations.proposed_branch_2', 'OPERATIONS', 'Địa điểm dự kiến cơ sở 2', '24A khu 7,2 hecta đường Vĩnh Phúc, phường Ngọc Hà, Ba Đình, Hà Nội', 'TEXT', 'Chỉ lưu kế hoạch; chưa tạo cơ sở nhận lịch vì thiếu giờ mở cửa, hotline và công suất.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-owner-contact', 'operations.owner_contact', 'GLOBAL:operations.owner_contact', 'OPERATIONS', 'Chủ cơ sở/người đại diện', 'NGUYỄN VĂN NGỌC · 0938648439 · Centertaman@gmail.com', 'TEXT', 'Thông tin nội bộ; không dùng thay hotline công khai.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-team-reception', 'operations.staff.reception', 'GLOBAL:operations.staff.reception', 'OPERATIONS', 'Lễ tân cơ sở 1', 'Châu Anh · Body/Foot/Head/Cổ vai gáy/Onsite · 09:00-18:00', 'TEXT', 'Thông tin phân ca theo phiếu nghiệp vụ.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-team-manager', 'operations.staff.manager', 'GLOBAL:operations.staff.manager', 'OPERATIONS', 'Quản lý cơ sở 1', 'Kiều Trang · 08:30-18:00', 'TEXT', 'Thông tin phân ca theo phiếu nghiệp vụ.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-price-approver', 'operations.price_approver', 'GLOBAL:operations.price_approver', 'OPERATIONS', 'Người duyệt giá/ưu đãi', 'Giám đốc', 'TEXT', 'Quyền chốt giá và khuyến mại.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-accounting-contact', 'operations.accounting_contact', 'GLOBAL:operations.accounting_contact', 'OPERATIONS', 'Phụ trách kế toán/đối soát', 'Lễ tân', 'TEXT', 'Đầu mối đối soát thanh toán, Tip và Affiliate.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-slot', 'booking.slot_minutes', 'GLOBAL:booking.slot_minutes', 'BOOKING', 'Bước khung giờ', '15', 'MINUTES', 'Mỗi khung bắt đầu cách nhau 15 phút.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-lead', 'booking.minimum_lead_minutes', 'GLOBAL:booking.minimum_lead_minutes', 'BOOKING', 'Đặt trước tối thiểu', '15', 'MINUTES', 'Không nhận booking online trong 15 phút tới.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-reschedule-notice', 'booking.reschedule_notice_minutes', 'GLOBAL:booking.reschedule_notice_minutes', 'BOOKING', 'Báo trước khi đổi lịch', '30', 'MINUTES', 'Khách được đổi một lần và cần báo trước ít nhất 30 phút.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-late-cancel', 'booking.late_cancel_minutes', 'GLOBAL:booking.late_cancel_minutes', 'BOOKING', 'Mốc xử lý khách đến muộn', '15', 'MINUTES', 'Sau 15 phút, lễ tân xử lý hủy/no-show theo tình huống thực tế.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-max-group', 'booking.max_group_size', 'GLOBAL:booking.max_group_size', 'BOOKING', 'Số người tối đa mỗi booking', '6', 'NUMBER', 'Áp dụng cho đặt nhóm, mời bạn và mời sếp.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-aff-rate', 'affiliate.commission_rate_percent', 'GLOBAL:affiliate.commission_rate_percent', 'AFFILIATE', 'Hoa hồng Affiliate', '10', 'PERCENT', 'Tính trên doanh thu dịch vụ/gói đủ điều kiện; không tính Tip.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-aff-return', 'affiliate.return_window_days', 'GLOBAL:affiliate.return_window_days', 'AFFILIATE', 'Cửa sổ khách quay lại', '7', 'DAYS', 'Hoa hồng lượt quay lại áp dụng trong 7 ngày.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-aff-cycle', 'affiliate.reconciliation_cycle_days', 'GLOBAL:affiliate.reconciliation_cycle_days', 'AFFILIATE', 'Chu kỳ đối soát Affiliate', '15', 'DAYS', 'Đối soát/chuyển khoản theo kỳ 15 ngày.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-review-delay', 'notification.review_delay_minutes', 'GLOBAL:notification.review_delay_minutes', 'NOTIFICATION', 'Xin đánh giá sau dịch vụ', '60', 'MINUTES', 'Tạo tác vụ xin đánh giá sau một giờ.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-remind-before', 'notification.booking_reminder_minutes', 'GLOBAL:notification.booking_reminder_minutes', 'NOTIFICATION', 'Nhắc trước giờ hẹn', '30', 'MINUTES', 'Mốc nhắc lịch theo phiếu nghiệp vụ.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-package-expiry', 'notification.package_expiry_days', 'GLOBAL:notification.package_expiry_days', 'NOTIFICATION', 'Nhắc gói sắp hết hạn', '5', 'DAYS', 'Nhắc trước năm ngày.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-daily-close', 'finance.daily_close_time', 'GLOBAL:finance.daily_close_time', 'FINANCE', 'Giờ chốt sổ hằng ngày', '23:00', 'TIME', 'Báo cáo cho chủ cơ sở.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-manager-rate', 'finance.manager_revenue_percent', 'GLOBAL:finance.manager_revenue_percent', 'FINANCE', 'Tỷ lệ quản lý', '3', 'PERCENT', 'Chi phí quản lý dự kiến theo doanh thu.', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-rent-budget', 'finance.fixed.rent', 'GLOBAL:finance.fixed.rent', 'FINANCE', 'Mặt bằng dự kiến/tháng', '40000000', 'NUMBER', 'Ngân sách P&L dự kiến.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-utility-budget', 'finance.fixed.utilities', 'GLOBAL:finance.fixed.utilities', 'FINANCE', 'Điện nước dự kiến/tháng', '10000000', 'NUMBER', 'Ngân sách P&L dự kiến.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-payroll-budget', 'finance.fixed.payroll', 'GLOBAL:finance.fixed.payroll', 'FINANCE', 'Lương cứng dự kiến/tháng', '60000000', 'NUMBER', 'Ngân sách P&L dự kiến.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-marketing-budget', 'finance.fixed.marketing', 'GLOBAL:finance.fixed.marketing', 'FINANCE', 'Marketing dự kiến/tháng', '30000000', 'NUMBER', 'Ngân sách P&L dự kiến.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-software-rate', 'finance.software_percent', 'GLOBAL:finance.software_percent', 'FINANCE', 'Phần mềm dự kiến', '10', 'PERCENT', 'Chi phí phần mềm dự kiến theo doanh thu.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting-taman-supplies-budget', 'finance.fixed.supplies', 'GLOBAL:finance.fixed.supplies', 'FINANCE', 'Vật tư dự kiến/tháng', '5000000', 'NUMBER', 'Ngân sách P&L dự kiến.', 'tam-an-center-tay-ho', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "category" = EXCLUDED."category", "label" = EXCLUDED."label",
  "value" = EXCLUDED."value", "valueType" = EXCLUDED."valueType",
  "description" = EXCLUDED."description", "branchId" = EXCLUDED."branchId",
  "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;
