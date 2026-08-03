CREATE TYPE "BusinessEventStatus" AS ENUM (
  'AWAITING_DEPOSIT',
  'DEPOSIT_CONFIRMED',
  'READY',
  'IN_SERVICE',
  'AWAITING_BALANCE',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "OfficeEvent"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "leadTherapistId" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "taxCode" TEXT,
  ADD COLUMN "serviceLabel" TEXT,
  ADD COLUMN "packageTier" TEXT,
  ADD COLUMN "headcount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "durationMin" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "requiredTherapists" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sessionsTotal" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actualStartedAt" TIMESTAMP(3),
  ADD COLUMN "expectedEndAt" TIMESTAMP(3),
  ADD COLUMN "actualEndedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "endReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "transportFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "depositAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "status" "BusinessEventStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "qrVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "customerRating" INTEGER,
  ADD COLUMN "customerComment" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "PaymentTransaction" ADD COLUMN "officeEventId" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "officeEventId" TEXT;
ALTER TABLE "TipPayout"
  ALTER COLUMN "bookingId" DROP NOT NULL,
  ADD COLUMN "officeEventId" TEXT;

CREATE TABLE "BusinessAccessGrant" (
  "id" TEXT NOT NULL,
  "guestSessionId" TEXT NOT NULL,
  "officeEventId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficeEvent_branchId_status_startsAt_idx" ON "OfficeEvent"("branchId", "status", "startsAt");
CREATE INDEX "OfficeEvent_customerId_createdAt_idx" ON "OfficeEvent"("customerId", "createdAt");
CREATE INDEX "OfficeEvent_leadTherapistId_status_startsAt_idx" ON "OfficeEvent"("leadTherapistId", "status", "startsAt");
CREATE INDEX "PaymentTransaction_officeEventId_status_createdAt_idx" ON "PaymentTransaction"("officeEventId", "status", "createdAt");
CREATE INDEX "LedgerEntry_officeEventId_occurredAt_idx" ON "LedgerEntry"("officeEventId", "occurredAt");
CREATE UNIQUE INDEX "TipPayout_officeEventId_key" ON "TipPayout"("officeEventId");
CREATE UNIQUE INDEX "BusinessAccessGrant_guestSessionId_officeEventId_key" ON "BusinessAccessGrant"("guestSessionId", "officeEventId");
CREATE INDEX "BusinessAccessGrant_officeEventId_expiresAt_idx" ON "BusinessAccessGrant"("officeEventId", "expiresAt");

ALTER TABLE "OfficeEvent" ADD CONSTRAINT "OfficeEvent_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficeEvent" ADD CONSTRAINT "OfficeEvent_leadTherapistId_fkey"
  FOREIGN KEY ("leadTherapistId") REFERENCES "Therapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_officeEventId_fkey"
  FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_officeEventId_fkey"
  FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TipPayout" ADD CONSTRAINT "TipPayout_officeEventId_fkey"
  FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAccessGrant" ADD CONSTRAINT "BusinessAccessGrant_guestSessionId_fkey"
  FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessAccessGrant" ADD CONSTRAINT "BusinessAccessGrant_officeEventId_fkey"
  FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeEvent"
  ADD CONSTRAINT "OfficeEvent_money_check" CHECK (
    "subtotalAmount" >= 0 AND "discountAmount" >= 0 AND "transportFee" >= 0
    AND "totalAmount" >= 0 AND "depositAmount" >= 0 AND "paidAmount" >= 0
  ),
  ADD CONSTRAINT "OfficeEvent_capacity_check" CHECK (
    "headcount" > 0 AND "durationMin" > 0 AND "requiredTherapists" > 0
    AND "sessionsTotal" > 0 AND "sessionsUsed" >= 0
  ),
  ADD CONSTRAINT "OfficeEvent_rating_check" CHECK ("customerRating" IS NULL OR "customerRating" BETWEEN 1 AND 5);
