ALTER TABLE "CustomerPackage" ADD COLUMN "paymentTransactionId" TEXT;
CREATE UNIQUE INDEX "CustomerPackage_paymentTransactionId_key" ON "CustomerPackage"("paymentTransactionId");
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PaymentAccessGrant" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAccessGrant_guestSessionId_paymentTransactionId_key" ON "PaymentAccessGrant"("guestSessionId", "paymentTransactionId");
CREATE INDEX "PaymentAccessGrant_paymentTransactionId_expiresAt_idx" ON "PaymentAccessGrant"("paymentTransactionId", "expiresAt");

ALTER TABLE "PaymentAccessGrant" ADD CONSTRAINT "PaymentAccessGrant_guestSessionId_fkey"
FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccessGrant" ADD CONSTRAINT "PaymentAccessGrant_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
