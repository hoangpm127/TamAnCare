ALTER TABLE "User" ADD COLUMN "therapistId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_therapistId_fkey"
FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_therapistId_idx" ON "User"("therapistId");

-- Link normal KTV accounts by their existing display name first.
UPDATE "User" AS account
SET "therapistId" = therapist."id"
FROM "Therapist" AS therapist
WHERE account."role" = 'THERAPIST'
  AND account."branchId" = therapist."branchId"
  AND account."name" = therapist."fullName"
  AND account."therapistId" IS NULL;

-- UAT shortcut accounts such as ktvcs1/ktvcs2 intentionally represent one
-- active KTV at their branch. Pick a stable record instead of matching the
-- generic account display name to a non-existent therapist.
UPDATE "User" AS account
SET "therapistId" = (
  SELECT therapist."id"
  FROM "Therapist" AS therapist
  WHERE therapist."branchId" = account."branchId"
    AND therapist."status" = 'ACTIVE'
  ORDER BY therapist."fullName" ASC, therapist."id" ASC
  LIMIT 1
)
WHERE account."role" = 'THERAPIST'
  AND account."therapistId" IS NULL;
