CREATE INDEX "VoucherUsage_customerId_status_expiresAt_idx"
ON "VoucherUsage"("customerId", "status", "expiresAt");
