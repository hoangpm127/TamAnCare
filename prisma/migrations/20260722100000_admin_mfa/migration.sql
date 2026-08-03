ALTER TABLE "User"
  ADD COLUMN "totpSecretEncrypted" TEXT,
  ADD COLUMN "mfaSetupExpiresAt" TIMESTAMP(3),
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "lastTotpCounter" INTEGER;

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");
CREATE INDEX "MfaRecoveryCode_userId_consumedAt_idx" ON "MfaRecoveryCode"("userId", "consumedAt");

ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
