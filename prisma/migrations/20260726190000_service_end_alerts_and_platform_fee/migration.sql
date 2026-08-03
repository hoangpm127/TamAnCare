ALTER TYPE "LedgerCategory" ADD VALUE IF NOT EXISTS 'PLATFORM_FEE';

ALTER TABLE "Booking"
ADD COLUMN "endingSoonReminderSentAt" TIMESTAMP(3);

CREATE INDEX "Booking_status_endingSoonReminderSentAt_idx"
ON "Booking"("status", "endingSoonReminderSentAt");
