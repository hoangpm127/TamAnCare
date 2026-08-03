-- Publish the first named Tâm An Center therapist profiles without inventing
-- customer reviews, completed-session counts, phone numbers, or login accounts.
INSERT INTO "Therapist" (
  "id", "branchId", "fullName", "gender", "skills", "shiftLabel",
  "status", "onlineBooking", "ratingAvg", "servedCount", "repeatCount",
  "publicBio", "publicStrengths", "profileApprovalStatus",
  "profileReviewedAt", "internalNote", "createdAt", "updatedAt"
)
VALUES
  (
    'tam-an-ktv-huong-lan', 'tam-an-center-tay-ho', 'Hương Lan', 'FEMALE',
    ARRAY['Massage chân', 'Thư giãn vùng đầu', 'Lực nhẹ']::TEXT[], 'Theo lịch cơ sở',
    'ACTIVE', true, 5, 0, 0,
    'Phong cách chăm sóc nhẹ nhàng và tỉ mỉ, phù hợp khách mới, khách lớn tuổi hoặc người muốn thư giãn sau một ngày di chuyển nhiều. Ưu tiên hỏi kỹ mức lực và cảm nhận của khách trong suốt buổi chăm sóc.',
    ARRAY['Lực nhẹ dễ chịu', 'Massage chân', 'Thư giãn vùng đầu']::TEXT[],
    'APPROVED', CURRENT_TIMESTAMP, 'Hồ sơ khởi tạo theo danh sách chủ cơ sở; chưa cấp tài khoản KTV và chưa có đánh giá khách hàng.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tam-an-ktv-thu-hoai', 'tam-an-center-tay-ho', 'Thu Hoài', 'FEMALE',
    ARRAY['Cổ vai gáy', 'Lưng hông', 'Lực vừa']::TEXT[], 'Theo lịch cơ sở',
    'ACTIVE', true, 5, 0, 0,
    'Tập trung chăm sóc vùng cổ vai gáy và lưng hông cho khách thường xuyên ngồi lâu hoặc vận động nhiều. Thao tác theo lực vừa, điều chỉnh theo phản hồi để buổi chăm sóc thoải mái và đúng vùng khách cần.',
    ARRAY['Cổ vai gáy', 'Lưng hông', 'Lực vừa linh hoạt']::TEXT[],
    'APPROVED', CURRENT_TIMESTAMP, 'Hồ sơ khởi tạo theo danh sách chủ cơ sở; chưa cấp tài khoản KTV và chưa có đánh giá khách hàng.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tam-an-ktv-thanh-hoa', 'tam-an-center-tay-ho', 'Thanh Hoa', 'FEMALE',
    ARRAY['Massage Body', 'Lưng hông', 'Lực khá']::TEXT[], 'Theo lịch cơ sở',
    'ACTIVE', true, 5, 0, 0,
    'Phù hợp khách thích massage Body với lực rõ và nhịp chăm sóc chắc tay. Chú trọng các nhóm cơ dễ căng mỏi ở lưng, vai và chân, đồng thời luôn xác nhận mức lực trước khi thực hiện.',
    ARRAY['Massage Body', 'Chăm sóc lưng hông', 'Lực khá có kiểm soát']::TEXT[],
    'APPROVED', CURRENT_TIMESTAMP, 'Hồ sơ khởi tạo theo danh sách chủ cơ sở; chưa cấp tài khoản KTV và chưa có đánh giá khách hàng.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tam-an-ktv-ngoc-tram', 'tam-an-center-tay-ho', 'Ngọc Trâm', 'FEMALE',
    ARRAY['Massage bụng', 'Chườm thảo dược', 'Chăm sóc nhẹ nhàng']::TEXT[], 'Theo lịch cơ sở',
    'ACTIVE', true, 5, 0, 0,
    'Phong cách điềm tĩnh, kín đáo và nhẹ nhàng, nổi bật ở các dịch vụ thư giãn vùng bụng và chăm sóc kết hợp nhiệt ấm, ngải hoặc thảo dược. Phù hợp khách cần trải nghiệm chậm rãi, dễ chịu.',
    ARRAY['Massage bụng', 'Ngải và thảo dược', 'Chăm sóc kín đáo']::TEXT[],
    'APPROVED', CURRENT_TIMESTAMP, 'Hồ sơ khởi tạo theo danh sách chủ cơ sở; chưa cấp tài khoản KTV và chưa có đánh giá khách hàng.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'tam-an-ktv-phuong-linh', 'tam-an-center-tay-ho', 'Phương Linh', 'FEMALE',
    ARRAY['Massage Body', 'Cổ vai gáy', 'Massage chân']::TEXT[], 'Theo lịch cơ sở',
    'ACTIVE', true, 5, 0, 0,
    'Linh hoạt với các nhu cầu Body, cổ vai gáy và massage chân. Giao tiếp nhẹ nhàng, chủ động xác nhận vùng cần ưu tiên và mức lực để khách mới dễ lựa chọn và cảm thấy thoải mái.',
    ARRAY['Đa dạng dịch vụ', 'Lực vừa dễ chịu', 'Chăm sóc khách mới']::TEXT[],
    'APPROVED', CURRENT_TIMESTAMP, 'Hồ sơ khởi tạo theo danh sách chủ cơ sở; chưa cấp tài khoản KTV và chưa có đánh giá khách hàng.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "fullName" = EXCLUDED."fullName",
  "gender" = EXCLUDED."gender",
  "skills" = EXCLUDED."skills",
  "shiftLabel" = EXCLUDED."shiftLabel",
  "status" = EXCLUDED."status",
  "onlineBooking" = EXCLUDED."onlineBooking",
  "publicBio" = EXCLUDED."publicBio",
  "publicStrengths" = EXCLUDED."publicStrengths",
  "profileApprovalStatus" = EXCLUDED."profileApprovalStatus",
  "profileReviewedAt" = EXCLUDED."profileReviewedAt",
  "internalNote" = EXCLUDED."internalNote",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Connect only services that match each public profile. Existing links are
-- preserved, and no unrelated therapist or service data is removed.
INSERT INTO "_ServiceToTherapist" ("A", "B")
SELECT mapping."serviceId", mapping."therapistId"
FROM (
  VALUES
    ('svc-foot-60', 'tam-an-ktv-huong-lan'),
    ('svc-foot-90', 'tam-an-ktv-huong-lan'),
    ('svc-head-energy-45', 'tam-an-ktv-huong-lan'),
    ('svc-hot-herbal', 'tam-an-ktv-huong-lan'),
    ('svc-steam-15', 'tam-an-ktv-huong-lan'),

    ('svc-neck-60', 'tam-an-ktv-thu-hoai'),
    ('svc-neck-90', 'tam-an-ktv-thu-hoai'),
    ('svc-back-60', 'tam-an-ktv-thu-hoai'),
    ('svc-back-90', 'tam-an-ktv-thu-hoai'),
    ('svc-cupping', 'tam-an-ktv-thu-hoai'),
    ('svc-hot-stone', 'tam-an-ktv-thu-hoai'),

    ('svc-body-60', 'tam-an-ktv-thanh-hoa'),
    ('svc-body-90', 'tam-an-ktv-thanh-hoa'),
    ('svc-body-120', 'tam-an-ktv-thanh-hoa'),
    ('svc-back-60', 'tam-an-ktv-thanh-hoa'),
    ('svc-back-90', 'tam-an-ktv-thanh-hoa'),
    ('svc-hot-stone', 'tam-an-ktv-thanh-hoa'),

    ('svc-belly-45', 'tam-an-ktv-ngoc-tram'),
    ('svc-hot-herbal', 'tam-an-ktv-ngoc-tram'),
    ('svc-mugwort-mud', 'tam-an-ktv-ngoc-tram'),
    ('svc-hot-stone', 'tam-an-ktv-ngoc-tram'),
    ('svc-steam-15', 'tam-an-ktv-ngoc-tram'),

    ('svc-body-60', 'tam-an-ktv-phuong-linh'),
    ('svc-body-90', 'tam-an-ktv-phuong-linh'),
    ('svc-neck-60', 'tam-an-ktv-phuong-linh'),
    ('svc-foot-60', 'tam-an-ktv-phuong-linh'),
    ('svc-cupping', 'tam-an-ktv-phuong-linh'),
    ('svc-steam-15', 'tam-an-ktv-phuong-linh')
) AS mapping("serviceId", "therapistId")
WHERE EXISTS (SELECT 1 FROM "Service" service WHERE service."id" = mapping."serviceId")
  AND EXISTS (SELECT 1 FROM "Therapist" therapist WHERE therapist."id" = mapping."therapistId")
ON CONFLICT ("A", "B") DO NOTHING;
