CREATE TYPE "ExpenseEvidenceScanStatus" AS ENUM (
  'UPLOADED',
  'AI_REVIEW_READY',
  'AI_UNAVAILABLE',
  'AI_FAILED',
  'CONFIRMED'
);

CREATE TABLE "ExpenseEvidence" (
  "id" TEXT NOT NULL,
  "branchId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "scanStatus" "ExpenseEvidenceScanStatus" NOT NULL DEFAULT 'UPLOADED',
  "extractedAmount" INTEGER,
  "extractedVendor" TEXT,
  "extractedDate" TIMESTAMP(3),
  "extractedCategory" TEXT,
  "documentType" TEXT,
  "confidence" INTEGER,
  "scanNote" TEXT,
  "aiModel" TEXT,
  "aiResponseId" TEXT,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseEvidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "evidenceId" TEXT;

CREATE INDEX "Expense_evidenceId_idx" ON "Expense"("evidenceId");
CREATE INDEX "ExpenseEvidence_branchId_createdAt_idx" ON "ExpenseEvidence"("branchId", "createdAt");
CREATE INDEX "ExpenseEvidence_createdByUserId_createdAt_idx" ON "ExpenseEvidence"("createdByUserId", "createdAt");
CREATE INDEX "ExpenseEvidence_sha256_idx" ON "ExpenseEvidence"("sha256");
CREATE INDEX "ExpenseEvidence_usedAt_createdAt_idx" ON "ExpenseEvidence"("usedAt", "createdAt");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "ExpenseEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
