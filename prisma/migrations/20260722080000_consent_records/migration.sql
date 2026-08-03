CREATE TYPE "ConsentDocumentType" AS ENUM (
  'TERMS',
  'PRIVACY',
  'BOOKING_POLICY',
  'MARKETING'
);

CREATE TYPE "ConsentSource" AS ENUM (
  'CUSTOMER_REGISTRATION',
  'ONLINE_BOOKING',
  'ACCOUNT_SETTINGS'
);

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "guestSessionId" TEXT,
  "bookingGroupId" TEXT,
  "documentType" "ConsentDocumentType" NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "documentHash" TEXT NOT NULL,
  "source" "ConsentSource" NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "subjectHash" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "grantedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_customerId_documentType_createdAt_idx"
  ON "ConsentRecord"("customerId", "documentType", "createdAt");
CREATE INDEX "ConsentRecord_guestSessionId_createdAt_idx"
  ON "ConsentRecord"("guestSessionId", "createdAt");
CREATE INDEX "ConsentRecord_bookingGroupId_documentType_idx"
  ON "ConsentRecord"("bookingGroupId", "documentType");
CREATE INDEX "ConsentRecord_subjectHash_documentType_createdAt_idx"
  ON "ConsentRecord"("subjectHash", "documentType", "createdAt");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_guestSessionId_fkey"
  FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_bookingGroupId_fkey"
  FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
