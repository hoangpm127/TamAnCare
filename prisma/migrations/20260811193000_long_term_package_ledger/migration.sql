CREATE TYPE "PackageLedgerEvent" AS ENUM (
  'PURCHASE_CREATED',
  'REFERRAL_CAPTURED',
  'ACTIVATED',
  'SESSION_RESERVED',
  'SESSION_RELEASED',
  'SESSION_USED',
  'EXPIRED',
  'STATUS_CHANGED',
  'BALANCE_IMPORTED',
  'TRANSFERRED'
);

ALTER TABLE "CustomerPackage"
  ADD COLUMN "referrerCustomerId" TEXT,
  ADD COLUMN "referrerInput" TEXT,
  ADD COLUMN "referrerName" TEXT,
  ADD COLUMN "referrerPhone" TEXT,
  ADD COLUMN "planNameSnapshot" TEXT,
  ADD COLUMN "planPriceSnapshot" INTEGER,
  ADD COLUMN "serviceIdSnapshot" TEXT,
  ADD COLUMN "serviceNameSnapshot" TEXT,
  ADD COLUMN "validityDaysSnapshot" INTEGER,
  ADD COLUMN "shareableSnapshot" BOOLEAN,
  ADD COLUMN "transferableSnapshot" BOOLEAN,
  ADD COLUMN "activatedAt" TIMESTAMP(3);

UPDATE "CustomerPackage" AS package
SET
  "planNameSnapshot" = plan."name",
  "planPriceSnapshot" = plan."price",
  "serviceIdSnapshot" = plan."serviceId",
  "serviceNameSnapshot" = service."name",
  "validityDaysSnapshot" = plan."validityDays",
  "shareableSnapshot" = plan."shareable",
  "transferableSnapshot" = plan."transferable"
FROM "PackagePlan" AS plan
LEFT JOIN "Service" AS service ON service."id" = plan."serviceId"
WHERE package."packagePlanId" = plan."id";

UPDATE "CustomerPackage" AS package
SET "activatedAt" = COALESCE(payment."paidAt", package."createdAt")
FROM "PaymentTransaction" AS payment
WHERE package."paymentTransactionId" = payment."id"
  AND payment."status" = 'CONFIRMED';

CREATE TABLE "PackageLedgerEntry" (
  "id" TEXT NOT NULL,
  "customerPackageId" TEXT NOT NULL,
  "packagePlanId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "branchId" TEXT,
  "paymentTransactionId" TEXT,
  "bookingId" TEXT,
  "bookingGroupId" TEXT,
  "event" "PackageLedgerEvent" NOT NULL,
  "availableDelta" INTEGER NOT NULL DEFAULT 0,
  "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "usedDelta" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageLedgerEntry_idempotencyKey_key" ON "PackageLedgerEntry"("idempotencyKey");
CREATE INDEX "CustomerPackage_referrerCustomerId_createdAt_idx" ON "CustomerPackage"("referrerCustomerId", "createdAt");
CREATE INDEX "CustomerPackage_status_createdAt_idx" ON "CustomerPackage"("status", "createdAt");
CREATE INDEX "PackageLedgerEntry_customerPackageId_occurredAt_idx" ON "PackageLedgerEntry"("customerPackageId", "occurredAt");
CREATE INDEX "PackageLedgerEntry_packagePlanId_occurredAt_idx" ON "PackageLedgerEntry"("packagePlanId", "occurredAt");
CREATE INDEX "PackageLedgerEntry_customerId_occurredAt_idx" ON "PackageLedgerEntry"("customerId", "occurredAt");
CREATE INDEX "PackageLedgerEntry_event_occurredAt_idx" ON "PackageLedgerEntry"("event", "occurredAt");
CREATE INDEX "PackageLedgerEntry_paymentTransactionId_idx" ON "PackageLedgerEntry"("paymentTransactionId");
CREATE INDEX "PackageLedgerEntry_bookingId_idx" ON "PackageLedgerEntry"("bookingId");
CREATE INDEX "PackageLedgerEntry_bookingGroupId_idx" ON "PackageLedgerEntry"("bookingGroupId");

ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_referrerCustomerId_fkey"
  FOREIGN KEY ("referrerCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_customerPackageId_fkey"
  FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_packagePlanId_fkey"
  FOREIGN KEY ("packagePlanId") REFERENCES "PackagePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_paymentTransactionId_fkey"
  FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PackageLedgerEntry" ADD CONSTRAINT "PackageLedgerEntry_bookingGroupId_fkey"
  FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PackageLedgerEntry" (
  "id", "customerPackageId", "packagePlanId", "customerId", "branchId",
  "paymentTransactionId", "event", "availableDelta", "reservedDelta", "usedDelta",
  "amount", "description", "metadata", "idempotencyKey", "occurredAt", "createdAt"
)
SELECT
  md5(random()::text || package."id" || clock_timestamp()::text),
  package."id",
  package."packagePlanId",
  package."customerId",
  payment."branchId",
  package."paymentTransactionId",
  'BALANCE_IMPORTED'::"PackageLedgerEvent",
  package."sessionsRemaining",
  package."sessionsReserved",
  GREATEST(0, package."sessionsTotal" - package."sessionsRemaining" - package."sessionsReserved"),
  CASE WHEN payment."status" = 'CONFIRMED' THEN payment."amount" ELSE 0 END,
  'Số dư gói được đưa vào sổ khi nâng cấp hệ thống',
  jsonb_build_object('source', 'migration', 'status', package."status"),
  'package:balance-import:' || package."id",
  COALESCE(payment."paidAt", package."createdAt"),
  CURRENT_TIMESTAMP
FROM "CustomerPackage" AS package
LEFT JOIN "PaymentTransaction" AS payment ON payment."id" = package."paymentTransactionId";
