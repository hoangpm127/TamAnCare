-- Persist the referral source on the anonymous device session. The source only
-- becomes eligible after the PWA is installed and opened in standalone mode.
ALTER TABLE "GuestSession"
ADD COLUMN "referralCampaignId" TEXT,
ADD COLUMN "referralCapturedAt" TIMESTAMP(3),
ADD COLUMN "referralInstalledAt" TIMESTAMP(3),
ADD COLUMN "referralExpiresAt" TIMESTAMP(3),
ADD COLUMN "referralClaimedCustomerId" TEXT;

ALTER TABLE "GuestSession"
ADD CONSTRAINT "GuestSession_referralCampaignId_fkey"
FOREIGN KEY ("referralCampaignId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestSession"
ADD CONSTRAINT "GuestSession_referralClaimedCustomerId_fkey"
FOREIGN KEY ("referralClaimedCustomerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GuestSession_referralCampaignId_referralInstalledAt_idx"
ON "GuestSession"("referralCampaignId", "referralInstalledAt");

CREATE INDEX "GuestSession_referralClaimedCustomerId_idx"
ON "GuestSession"("referralClaimedCustomerId");

-- Store each voucher's contribution so stacked vouchers can be reconciled
-- independently and WELCOME150 never consumes the Affiliate 50K portion.
ALTER TABLE "VoucherUsage"
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- The new flow intentionally allows WELCOME150 and AFF50 together. A 200K
-- minimum protects small add-on services from becoming a zero-value Bill.
UPDATE "Voucher"
SET
  "minimumSpend" = 200000,
  "requiresVerifiedPhone" = false,
  "displayConstraint" = 'Tài khoản mới · Bill từ 200K · được cộng AFF50 khi cài app qua link giới thiệu',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'WELCOME150';

UPDATE "Voucher"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'FIRST60';

INSERT INTO "Voucher" (
  "id", "code", "name", "description", "discountType", "discountValue",
  "minimumSpend", "maximumDiscount", "displayConstraint", "accentColor",
  "firstVisitOnly", "requiresAccount", "requiresVerifiedPhone",
  "minimumServiceDurationMin", "bookingStartMinuteMin", "bookingStartMinuteMax",
  "excludeWeekend", "validWithinDaysAfterLastVisit", "validAfterDaysAfterLastVisit",
  "maxUsage", "maxPerCustomer", "startsAt", "endsAt", "isActive",
  "campaignId", "serviceId", "createdAt", "updatedAt"
)
VALUES (
  'voucher-tam-an-aff50', 'AFF50', 'Quà cài app Affiliate 50K',
  'Tặng thêm 50.000đ cho khách cài Tâm An Center từ link giới thiệu; được cộng cùng WELCOME150 trong lần dịch vụ đầu tiên.',
  'FIXED', 50000, 200000, 50000,
  'Cài app từ link Affiliate · cộng cùng WELCOME150 · mỗi khách một lần', '#c64b32',
  true, true, false, NULL, NULL, NULL, false, NULL, NULL,
  NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '365 days', true,
  NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "discountType" = EXCLUDED."discountType",
  "discountValue" = EXCLUDED."discountValue",
  "minimumSpend" = EXCLUDED."minimumSpend",
  "maximumDiscount" = EXCLUDED."maximumDiscount",
  "displayConstraint" = EXCLUDED."displayConstraint",
  "accentColor" = EXCLUDED."accentColor",
  "firstVisitOnly" = EXCLUDED."firstVisitOnly",
  "requiresAccount" = EXCLUDED."requiresAccount",
  "requiresVerifiedPhone" = EXCLUDED."requiresVerifiedPhone",
  "maxUsage" = EXCLUDED."maxUsage",
  "maxPerCustomer" = EXCLUDED."maxPerCustomer",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
