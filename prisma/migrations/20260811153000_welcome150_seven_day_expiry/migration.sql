-- WELCOME150 is a rolling new-member benefit. The campaign itself stays
-- available, while each customer's grant expires exactly seven days after
-- welcomeCreditGrantedAt.
UPDATE "Voucher"
SET
  "endsAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'WELCOME150';

-- Remove balances that were already outside the new seven-day window when
-- this rule was deployed. Runtime checks and the maintenance job enforce the
-- same boundary for all future grants.
UPDATE "CustomerAccount"
SET
  "creditBalance" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "creditBalance" > 0
  AND (
    "welcomeCreditGrantedAt" IS NULL
    OR "welcomeCreditGrantedAt" + INTERVAL '7 days' <= CURRENT_TIMESTAMP
  );
