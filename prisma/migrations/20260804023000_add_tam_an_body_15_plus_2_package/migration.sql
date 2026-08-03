-- Add one longer Body plan at a manageable step above 9+1. The amount equals
-- 15 full-price Body sessions, with two sessions granted as the benefit.
INSERT INTO "PackagePlan" (
  "id", "name", "serviceId", "sessions", "paidSessions", "bonusSessions",
  "validityDays", "price", "badge", "isHighlighted", "isActive",
  "shareable", "transferable", "createdAt", "updatedAt"
)
VALUES (
  'pkg-body-15', 'Đồng hành Body 15+2', 'svc-body-60', 17, 15, 2,
  240, 6750000, 'Mua 15 tặng 2', true, true,
  false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
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
