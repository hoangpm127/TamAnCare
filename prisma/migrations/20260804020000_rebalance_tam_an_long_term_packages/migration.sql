-- Rebalance the public long-term package catalog against the official
-- Tâm An Center service prices. Historical plans are retained for existing
-- customer packages and accounting records, but are no longer sold.
UPDATE "PackagePlan"
SET
  "name" = 'Khởi động Cổ Vai Gáy 3 buổi',
  "serviceId" = 'svc-neck-60',
  "sessions" = 3,
  "paidSessions" = 3,
  "bonusSessions" = 0,
  "validityDays" = 45,
  "price" = 1050000,
  "badge" = 'Tiết kiệm 120K',
  "isHighlighted" = false,
  "isActive" = true,
  "shareable" = false,
  "transferable" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-3';

UPDATE "PackagePlan"
SET
  "name" = 'Chăm sóc Body 5 buổi',
  "serviceId" = 'svc-body-60',
  "sessions" = 5,
  "paidSessions" = 5,
  "bonusSessions" = 0,
  "validityDays" = 75,
  "price" = 2000000,
  "badge" = 'Tiết kiệm 250K',
  "isHighlighted" = false,
  "isActive" = true,
  "shareable" = false,
  "transferable" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-5';

UPDATE "PackagePlan"
SET
  "name" = 'Dài hạn Cổ Vai Gáy 9+1',
  "serviceId" = 'svc-neck-60',
  "sessions" = 10,
  "paidSessions" = 9,
  "bonusSessions" = 1,
  "validityDays" = 150,
  "price" = 3510000,
  "badge" = 'Mua 9 tặng 1',
  "isHighlighted" = true,
  "isActive" = true,
  "shareable" = false,
  "transferable" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-9';

INSERT INTO "PackagePlan" (
  "id", "name", "serviceId", "sessions", "paidSessions", "bonusSessions",
  "validityDays", "price", "badge", "isHighlighted", "isActive",
  "shareable", "transferable", "createdAt", "updatedAt"
)
VALUES
  ('pkg-foot-5', 'Thư giãn Chân 5 buổi', 'svc-foot-60', 5, 5, 0, 75, 1575000, 'Tiết kiệm 175K', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pkg-body-9', 'Dài hạn Body 9+1', 'svc-body-60', 10, 9, 1, 150, 4050000, 'Mua 9 tặng 1', true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "serviceId" = EXCLUDED."serviceId",
  "sessions" = EXCLUDED."sessions",
  "paidSessions" = EXCLUDED."paidSessions",
  "bonusSessions" = EXCLUDED."bonusSessions",
  "validityDays" = EXCLUDED."validityDays",
  "price" = EXCLUDED."price",
  "badge" = EXCLUDED."badge",
  "isHighlighted" = EXCLUDED."isHighlighted",
  "isActive" = EXCLUDED."isActive",
  "shareable" = EXCLUDED."shareable",
  "transferable" = EXCLUDED."transferable",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "PackagePlan"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('pkg-19', 'pkg-29', 'pkg-49');
