-- Match Tâm An Center Tây Hồ with the verified room layout of Tuệ Tâm Care branch 1:
-- 3 head-spa beds, 6 foot chairs, and 9 massage beds (18 service positions total).
-- Existing bookings and unrelated rooms are preserved.
UPDATE "Branch"
SET
  "seatCapacity" = 18,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tam-an-center-tay-ho';

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "note", "createdAt", "updatedAt"
)
SELECT
  format('tam-an-center-tay-ho-seat-%s', lpad(bed_number::text, 2, '0')),
  'tam-an-center-tay-ho',
  format('Giường gội %s', lpad(bed_number::text, 2, '0')),
  'HEAD_SPA_BED'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY['HEAD_SPA'::"ServiceCategory"],
  'Đồng bộ công suất theo cơ sở 1 Tuệ Tâm Care.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Branch"
CROSS JOIN generate_series(1, 3) AS bed_number
WHERE "Branch"."id" = 'tam-an-center-tay-ho'
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "note", "createdAt", "updatedAt"
)
SELECT
  format('tam-an-center-tay-ho-seat-%s', lpad((foot_number + 3)::text, 2, '0')),
  'tam-an-center-tay-ho',
  format('Giường Foot %s', lpad(foot_number::text, 2, '0')),
  'FOOT_CHAIR'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY['FOOT'::"ServiceCategory"],
  'Đồng bộ công suất theo cơ sở 1 Tuệ Tâm Care.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Branch"
CROSS JOIN generate_series(1, 6) AS foot_number
WHERE "Branch"."id" = 'tam-an-center-tay-ho'
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "note", "createdAt", "updatedAt"
)
SELECT
  format('tam-an-center-tay-ho-seat-%s', lpad((body_number + 9)::text, 2, '0')),
  'tam-an-center-tay-ho',
  format('Giường Body %s', lpad(body_number::text, 2, '0')),
  'MASSAGE_BED'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY[
    'BODY'::"ServiceCategory",
    'NECK_SHOULDER'::"ServiceCategory",
    'THERAPY'::"ServiceCategory",
    'COMBO'::"ServiceCategory"
  ],
  'Đồng bộ công suất theo cơ sở 1 Tuệ Tâm Care.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Branch"
CROSS JOIN generate_series(1, 9) AS body_number
WHERE "Branch"."id" = 'tam-an-center-tay-ho'
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;
