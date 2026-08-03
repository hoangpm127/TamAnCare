UPDATE "PackagePlan"
SET "shareable" = TRUE
WHERE "id" = 'pkg-19';

CREATE INDEX "BookingGroup_status_paymentStatus_holdExpiresAt_idx"
ON "BookingGroup"("status", "paymentStatus", "holdExpiresAt");
