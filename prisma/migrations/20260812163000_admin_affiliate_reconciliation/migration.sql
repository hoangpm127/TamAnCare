CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "AffiliatePayout" (
  "id" TEXT NOT NULL,
  "commissionLedgerEntryId" TEXT NOT NULL,
  "affiliateCustomerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "paidByUserId" TEXT,
  "bankNameSnapshot" TEXT,
  "bankAccountSnapshot" TEXT,
  "bankHolderSnapshot" TEXT,
  "transferReference" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliatePayout_commissionLedgerEntryId_key"
  ON "AffiliatePayout"("commissionLedgerEntryId");
CREATE INDEX "AffiliatePayout_status_dueAt_idx"
  ON "AffiliatePayout"("status", "dueAt");
CREATE INDEX "AffiliatePayout_affiliateCustomerId_status_dueAt_idx"
  ON "AffiliatePayout"("affiliateCustomerId", "status", "dueAt");
CREATE INDEX "AffiliatePayout_branchId_status_dueAt_idx"
  ON "AffiliatePayout"("branchId", "status", "dueAt");

ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_commissionLedgerEntryId_fkey"
  FOREIGN KEY ("commissionLedgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateCustomerId_fkey"
  FOREIGN KEY ("affiliateCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_paidByUserId_fkey"
  FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AffiliatePayout" (
  "id",
  "commissionLedgerEntryId",
  "affiliateCustomerId",
  "branchId",
  "status",
  "dueAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || ledger."id" || clock_timestamp()::text),
  ledger."id",
  ledger."customerId",
  ledger."branchId",
  'PENDING'::"AffiliatePayoutStatus",
  ledger."occurredAt" + INTERVAL '15 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "LedgerEntry" AS ledger
WHERE ledger."category" = 'OPERATING_EXPENSE'
  AND ledger."direction" = 'OUT'
  AND ledger."customerId" IS NOT NULL
  AND ledger."description" LIKE 'Hoa hồng Affiliate%'
ON CONFLICT ("commissionLedgerEntryId") DO NOTHING;
