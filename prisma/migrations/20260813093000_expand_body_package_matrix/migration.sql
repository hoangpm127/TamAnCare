-- Expand the approved long-term Body catalogue to 60/90/120 minutes x
-- 5/10/15 sessions. Historical purchases remain linked to their original
-- plans and keep their purchase snapshots; no customer data is deleted.

UPDATE "PackagePlan"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'pkg-3', 'pkg-19', 'pkg-29', 'pkg-49',
  'pkg-foot-5', 'pkg-body-9', 'pkg-body-15'
);

INSERT INTO "PackagePlan" (
  "id", "name", "description", "serviceId", "sessions", "paidSessions",
  "bonusSessions", "validityDays", "price", "badge", "isHighlighted",
  "isActive", "shareable", "transferable", "createdAt", "updatedAt"
)
VALUES
  (
    'pkg-5', 'Body 60 phút · 5 buổi',
    'Liệu trình Body 60 phút · tương đương 390.000đ/buổi.',
    'svc-body-60', 5, 5, 0, 60, 1950000, 'Tiết kiệm 300K',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-9', 'Body 60 phút · 10 buổi',
    'Liệu trình Body 60 phút · tương đương 350.000đ/buổi.',
    'svc-body-60', 10, 10, 0, 90, 3500000, 'Tiết kiệm 1 triệu',
    true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-60-15', 'Body 60 phút · 15 buổi',
    'Liệu trình Body 60 phút · tương đương 320.000đ/buổi.',
    'svc-body-60', 15, 15, 0, 90, 4800000, 'Tiết kiệm 1,95 triệu',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-90-5', 'Body 90 phút · 5 buổi',
    'Liệu trình Body 90 phút · tương đương 550.000đ/buổi.',
    'svc-body-90', 5, 5, 0, 60, 2750000, 'Tiết kiệm 500K',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-90-10', 'Body 90 phút · 10 buổi',
    'Liệu trình Body 90 phút · tương đương 500.000đ/buổi.',
    'svc-body-90', 10, 10, 0, 90, 5000000, 'Tiết kiệm 1,5 triệu',
    true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-90-15', 'Body 90 phút · 15 buổi',
    'Liệu trình Body 90 phút · tương đương 450.000đ/buổi.',
    'svc-body-90', 15, 15, 0, 90, 6750000, 'Tiết kiệm 3 triệu',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-120-5', 'Body 120 phút · 5 buổi',
    'Liệu trình Body 120 phút · tương đương 690.000đ/buổi.',
    'svc-body-120', 5, 5, 0, 90, 3450000, 'Tiết kiệm 500K',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-120-10', 'Body 120 phút · 10 buổi',
    'Liệu trình Body 120 phút · tương đương 650.000đ/buổi.',
    'svc-body-120', 10, 10, 0, 90, 6500000, 'Tiết kiệm 1,4 triệu',
    true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'pkg-body-120-15', 'Body 120 phút · 15 buổi',
    'Liệu trình Body 120 phút · tương đương 600.000đ/buổi.',
    'svc-body-120', 15, 15, 0, 90, 9000000, 'Tiết kiệm 2,85 triệu',
    false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "serviceId" = EXCLUDED."serviceId",
  "sessions" = EXCLUDED."sessions",
  "paidSessions" = EXCLUDED."paidSessions",
  "bonusSessions" = EXCLUDED."bonusSessions",
  "validityDays" = EXCLUDED."validityDays",
  "price" = EXCLUDED."price",
  "badge" = EXCLUDED."badge",
  "isHighlighted" = EXCLUDED."isHighlighted",
  "isActive" = true,
  "shareable" = false,
  "transferable" = false,
  "updatedAt" = CURRENT_TIMESTAMP;
