CREATE TYPE "LedgerDataOrigin" AS ENUM ('LIVE', 'IMPORTED', 'DEMO');

ALTER TABLE "LedgerEntry"
ADD COLUMN "dataOrigin" "LedgerDataOrigin" NOT NULL DEFAULT 'LIVE';

-- The database attached to this migration is the existing UAT/demo database.
-- Preserve its history, but make the origin explicit so production reports can
-- exclude it without deleting or rewriting financial records.
UPDATE "LedgerEntry" SET "dataOrigin" = 'DEMO';

CREATE INDEX "LedgerEntry_dataOrigin_occurredAt_idx"
ON "LedgerEntry"("dataOrigin", "occurredAt");
