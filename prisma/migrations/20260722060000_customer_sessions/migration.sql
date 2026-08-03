CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_customerId_expiresAt_idx" ON "CustomerSession"("customerId", "expiresAt");
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

ALTER TABLE "CustomerSession"
ADD CONSTRAINT "CustomerSession_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("customerId")
ON DELETE CASCADE ON UPDATE CASCADE;
