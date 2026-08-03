CREATE TYPE "CustomerOAuthProvider" AS ENUM ('GOOGLE', 'FACEBOOK');

ALTER TABLE "CustomerAccount"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "CustomerOAuthIdentity" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "provider" "CustomerOAuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "emailVerifiedAt" TIMESTAMP(3),
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "pendingExpiresAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerOAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerOAuthIdentity_provider_providerAccountId_key"
  ON "CustomerOAuthIdentity"("provider", "providerAccountId");

CREATE INDEX "CustomerOAuthIdentity_customerId_idx"
  ON "CustomerOAuthIdentity"("customerId");

CREATE INDEX "CustomerOAuthIdentity_pendingExpiresAt_idx"
  ON "CustomerOAuthIdentity"("pendingExpiresAt");

ALTER TABLE "CustomerOAuthIdentity"
  ADD CONSTRAINT "CustomerOAuthIdentity_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
