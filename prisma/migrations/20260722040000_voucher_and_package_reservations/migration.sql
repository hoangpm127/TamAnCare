ALTER TABLE "VoucherUsage"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3);

UPDATE "VoucherUsage" SET "confirmedAt" = "usedAt" WHERE "status" = 'CONFIRMED';

CREATE UNIQUE INDEX "VoucherUsage_voucherId_bookingId_key" ON "VoucherUsage"("voucherId", "bookingId");
CREATE INDEX "VoucherUsage_voucherId_status_expiresAt_idx" ON "VoucherUsage"("voucherId", "status", "expiresAt");

ALTER TABLE "CustomerPackage" ADD COLUMN "sessionsReserved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingGroup" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
