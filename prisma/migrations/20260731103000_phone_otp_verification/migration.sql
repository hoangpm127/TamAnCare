CREATE TYPE "PhoneOtpPurpose" AS ENUM (
  'CUSTOMER_SIGNUP',
  'CUSTOMER_SOCIAL_SIGNUP',
  'ACCOUNT_PHONE',
  'VOUCHER_CLAIM',
  'AFFILIATE_ACTIVATION',
  'CHANGE_PHONE'
);

CREATE TYPE "OtpDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'TEST_MODE',
  'FAILED'
);

ALTER TABLE "CustomerAccount"
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Voucher"
  ADD COLUMN "requiresVerifiedPhone" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PhoneOtpChallenge" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "phoneHash" TEXT NOT NULL,
  "purpose" "PhoneOtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "verificationTokenHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "deliveryStatus" "OtpDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneOtpChallenge_verificationTokenHash_key"
  ON "PhoneOtpChallenge"("verificationTokenHash");
CREATE INDEX "PhoneOtpChallenge_phoneHash_purpose_createdAt_idx"
  ON "PhoneOtpChallenge"("phoneHash", "purpose", "createdAt");
CREATE INDEX "PhoneOtpChallenge_expiresAt_consumedAt_idx"
  ON "PhoneOtpChallenge"("expiresAt", "consumedAt");
CREATE INDEX "PhoneOtpChallenge_customerId_purpose_createdAt_idx"
  ON "PhoneOtpChallenge"("customerId", "purpose", "createdAt");

ALTER TABLE "PhoneOtpChallenge"
  ADD CONSTRAINT "PhoneOtpChallenge_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("customerId")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Voucher"
SET "requiresVerifiedPhone" = true
WHERE "code" IN ('WELCOME100', 'FIRST60');
