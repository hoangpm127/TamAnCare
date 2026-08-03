-- Keep exactly the single-service menu supplied by Tâm An Center.
-- Higher-duration variants are retired without deleting booking or payment history.
UPDATE "Service"
SET
  "isActive" = false,
  "isOnline" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'svc-body-90',
  'svc-body-120',
  'svc-neck-90',
  'svc-foot-90',
  'svc-back-90'
);

-- Reassert the eleven services and prices shown in the supplied price list.
UPDATE "Service"
SET
  "basePrice" = CASE "id"
    WHEN 'svc-body-60' THEN 450000
    WHEN 'svc-neck-60' THEN 390000
    WHEN 'svc-foot-60' THEN 350000
    WHEN 'svc-back-60' THEN 390000
    WHEN 'svc-steam-15' THEN 150000
    WHEN 'svc-cupping' THEN 150000
    WHEN 'svc-hot-stone' THEN 80000
    WHEN 'svc-mugwort-mud' THEN 150000
    WHEN 'svc-hot-herbal' THEN 250000
    WHEN 'svc-head-energy-45' THEN 450000
    WHEN 'svc-belly-45' THEN 350000
    ELSE "basePrice"
  END,
  "isActive" = true,
  "isOnline" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'svc-body-60',
  'svc-neck-60',
  'svc-foot-60',
  'svc-back-60',
  'svc-steam-15',
  'svc-cupping',
  'svc-hot-stone',
  'svc-mugwort-mud',
  'svc-hot-herbal',
  'svc-head-energy-45',
  'svc-belly-45'
);
