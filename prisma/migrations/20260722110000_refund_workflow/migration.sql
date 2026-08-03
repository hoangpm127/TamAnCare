CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "RefundRequest" (
  "id" TEXT NOT NULL,
  "sourcePaymentId" TEXT NOT NULL,
  "refundPaymentId" TEXT,
  "bookingGroupId" TEXT,
  "bookingId" TEXT,
  "branchId" TEXT NOT NULL,
  "customerId" TEXT,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "completedByUserId" TEXT,
  "approvalNote" TEXT,
  "bankReference" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundRequest_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "RefundRequest_refundPaymentId_key" ON "RefundRequest"("refundPaymentId");
CREATE UNIQUE INDEX "RefundRequest_bankReference_key" ON "RefundRequest"("bankReference");
CREATE INDEX "RefundRequest_sourcePaymentId_status_idx" ON "RefundRequest"("sourcePaymentId", "status");
CREATE INDEX "RefundRequest_branchId_createdAt_idx" ON "RefundRequest"("branchId", "createdAt");
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");
CREATE INDEX "RefundRequest_customerId_createdAt_idx" ON "RefundRequest"("customerId", "createdAt");

ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_sourcePaymentId_fkey"
  FOREIGN KEY ("sourcePaymentId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_refundPaymentId_fkey"
  FOREIGN KEY ("refundPaymentId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_bookingGroupId_fkey"
  FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
