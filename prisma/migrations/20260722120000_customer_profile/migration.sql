ALTER TABLE "Customer" ADD COLUMN "healthNotes" TEXT;
ALTER TABLE "CustomerAccount" ADD COLUMN "bookingReminders" BOOLEAN NOT NULL DEFAULT true;
