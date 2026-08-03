CREATE TYPE "PasswordResetDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'TEST_MODE',
  'FAILED',
  'IGNORED'
);

CREATE TABLE "PasswordResetChallenge" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "phoneHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "consumedAt" TIMESTAMP(3),
  "deliveryStatus" "PasswordResetDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetChallenge_phoneHash_createdAt_idx"
  ON "PasswordResetChallenge"("phoneHash", "createdAt");
CREATE INDEX "PasswordResetChallenge_expiresAt_consumedAt_idx"
  ON "PasswordResetChallenge"("expiresAt", "consumedAt");
CREATE INDEX "PasswordResetChallenge_customerId_createdAt_idx"
  ON "PasswordResetChallenge"("customerId", "createdAt");

ALTER TABLE "PasswordResetChallenge" ADD CONSTRAINT "PasswordResetChallenge_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("customerId") ON DELETE CASCADE ON UPDATE CASCADE;
