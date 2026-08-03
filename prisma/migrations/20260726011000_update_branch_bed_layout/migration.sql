UPDATE "Branch"
SET "address" = 'Số 1 Hoàng Quán Chi, Dịch Vọng, Cầu Giấy, Hà Nội',
    "seatCapacity" = 18,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cs1';

UPDATE "Branch"
SET "address" = 'A11 LK6D BCA, Nguyễn Văn Lộc, Hà Đông, Hà Nội',
    "seatCapacity" = 18,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cs2';

ALTER TABLE "Branch" ALTER COLUMN "seatCapacity" SET DEFAULT 18;

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "createdAt", "updatedAt"
)
SELECT
  format('%s-seat-%s', branch_id, lpad(bed_number::text, 2, '0')),
  branch_id,
  format('Giường gội %s', lpad(bed_number::text, 2, '0')),
  'HEAD_SPA_BED'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY['HEAD_SPA'::"ServiceCategory"],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES ('cs1'), ('cs2')) AS branches(branch_id)
JOIN "Branch" AS existing_branch ON existing_branch."id" = branches.branch_id
CROSS JOIN generate_series(1, 3) AS bed_number
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "createdAt", "updatedAt"
)
SELECT
  format('%s-seat-%s', branch_id, lpad((foot_number + 3)::text, 2, '0')),
  branch_id,
  format('Giường Foot %s', lpad(foot_number::text, 2, '0')),
  'FOOT_CHAIR'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY['FOOT'::"ServiceCategory"],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES ('cs1'), ('cs2')) AS branches(branch_id)
JOIN "Branch" AS existing_branch ON existing_branch."id" = branches.branch_id
CROSS JOIN generate_series(1, 6) AS foot_number
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Room" (
  "id", "branchId", "name", "type", "status", "suitableCategories", "createdAt", "updatedAt"
)
SELECT
  format('%s-seat-%s', branch_id, lpad((body_number + 9)::text, 2, '0')),
  branch_id,
  format('Giường Body %s', lpad(body_number::text, 2, '0')),
  'MASSAGE_BED'::"RoomType",
  'ACTIVE'::"RoomStatus",
  ARRAY[
    'BODY'::"ServiceCategory",
    'NECK_SHOULDER'::"ServiceCategory",
    'THERAPY'::"ServiceCategory",
    'COMBO'::"ServiceCategory"
  ],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES ('cs1'), ('cs2')) AS branches(branch_id)
JOIN "Branch" AS existing_branch ON existing_branch."id" = branches.branch_id
CROSS JOIN generate_series(1, 9) AS body_number
ON CONFLICT ("id") DO UPDATE SET
  "branchId" = EXCLUDED."branchId",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "suitableCategories" = EXCLUDED."suitableCategories",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Giữ liên kết của booking lịch sử nhưng ngừng cấp các vị trí ngoài sơ đồ 18 giường mới.
UPDATE "Room"
SET "status" = 'HIDDEN',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "branchId" IN ('cs1', 'cs2')
  AND "id" NOT IN (
    SELECT format('%s-seat-%s', branch_id, lpad(bed_number::text, 2, '0'))
    FROM (VALUES ('cs1'), ('cs2')) AS branches(branch_id)
    CROSS JOIN generate_series(1, 18) AS bed_number
  );
