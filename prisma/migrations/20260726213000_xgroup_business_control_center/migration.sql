ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'XGROUP_SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISTRICT_SALES_MANAGER';

CREATE TYPE "BusinessPartnerStatus" AS ENUM ('PENDING_DUE_DILIGENCE', 'ACTIVE', 'PAUSED', 'SUSPENDED');
CREATE TYPE "BusinessMediaType" AS ENUM ('LINK', 'QR', 'VIDEO');
CREATE TYPE "BusinessMediaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "BusinessLeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'QUOTED', 'AWAITING_DEPOSIT', 'SCHEDULED', 'IN_SERVICE', 'WON', 'LOST');
CREATE TYPE "BusinessAllocationRecipient" AS ENUM ('KTV_DIRECT', 'TEAM_LEADER', 'XGROUP_PLATFORM', 'DISTRICT_DIRECTOR', 'DIRECT_AFFILIATE');
CREATE TYPE "BusinessAllocationStatus" AS ENUM ('PENDING', 'READY', 'APPROVED', 'PAID', 'ON_HOLD', 'VOID');

CREATE TABLE "BusinessDistrict" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Hà Nội',
    "managerUserId" TEXT,
    "annualGmvTarget" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessDistrict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessAffiliate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "organization" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "referrerProfile" TEXT NOT NULL,
    "status" "BusinessPartnerStatus" NOT NULL DEFAULT 'PENDING_DUE_DILIGENCE',
    "commissionRateBps" INTEGER NOT NULL DEFAULT 1000,
    "conflictDisclosureRequired" BOOLEAN NOT NULL DEFAULT false,
    "conflictDisclosureAcceptedAt" TIMESTAMP(3),
    "complianceNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessAffiliate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMediaAsset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "districtId" TEXT,
    "affiliateId" TEXT,
    "type" "BusinessMediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "videoUrl" TEXT,
    "status" "BusinessMediaStatus" NOT NULL DEFAULT 'DRAFT',
    "qrVersion" INTEGER NOT NULL DEFAULT 1,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessLead" (
    "id" TEXT NOT NULL,
    "leadCode" TEXT NOT NULL,
    "districtId" TEXT,
    "affiliateId" TEXT,
    "sourceAssetId" TEXT,
    "officeEventId" TEXT,
    "ownerUserId" TEXT,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "officeAddress" TEXT,
    "estimatedGmv" INTEGER NOT NULL DEFAULT 0,
    "stage" "BusinessLeadStage" NOT NULL DEFAULT 'NEW',
    "expectedCloseAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "lostReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessAttribution" (
    "id" TEXT NOT NULL,
    "officeEventId" TEXT NOT NULL,
    "districtId" TEXT,
    "affiliateId" TEXT,
    "sourceAssetId" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "tipExcludedAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessAllocation" (
    "id" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "recipient" "BusinessAllocationRecipient" NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "beneficiaryLabel" TEXT NOT NULL,
    "beneficiaryReference" TEXT,
    "status" "BusinessAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "bankReference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessDistrict_code_key" ON "BusinessDistrict"("code");
CREATE UNIQUE INDEX "BusinessDistrict_managerUserId_key" ON "BusinessDistrict"("managerUserId");
CREATE INDEX "BusinessDistrict_city_isActive_idx" ON "BusinessDistrict"("city", "isActive");
CREATE UNIQUE INDEX "BusinessAffiliate_code_key" ON "BusinessAffiliate"("code");
CREATE INDEX "BusinessAffiliate_districtId_status_idx" ON "BusinessAffiliate"("districtId", "status");
CREATE INDEX "BusinessAffiliate_createdByUserId_createdAt_idx" ON "BusinessAffiliate"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "BusinessMediaAsset_code_key" ON "BusinessMediaAsset"("code");
CREATE INDEX "BusinessMediaAsset_districtId_status_idx" ON "BusinessMediaAsset"("districtId", "status");
CREATE INDEX "BusinessMediaAsset_affiliateId_status_idx" ON "BusinessMediaAsset"("affiliateId", "status");
CREATE INDEX "BusinessMediaAsset_type_status_idx" ON "BusinessMediaAsset"("type", "status");
CREATE UNIQUE INDEX "BusinessLead_leadCode_key" ON "BusinessLead"("leadCode");
CREATE UNIQUE INDEX "BusinessLead_officeEventId_key" ON "BusinessLead"("officeEventId");
CREATE INDEX "BusinessLead_districtId_stage_createdAt_idx" ON "BusinessLead"("districtId", "stage", "createdAt");
CREATE INDEX "BusinessLead_affiliateId_stage_idx" ON "BusinessLead"("affiliateId", "stage");
CREATE INDEX "BusinessLead_ownerUserId_stage_idx" ON "BusinessLead"("ownerUserId", "stage");
CREATE UNIQUE INDEX "BusinessAttribution_officeEventId_key" ON "BusinessAttribution"("officeEventId");
CREATE INDEX "BusinessAttribution_districtId_createdAt_idx" ON "BusinessAttribution"("districtId", "createdAt");
CREATE INDEX "BusinessAttribution_affiliateId_createdAt_idx" ON "BusinessAttribution"("affiliateId", "createdAt");
CREATE INDEX "BusinessAttribution_sourceAssetId_createdAt_idx" ON "BusinessAttribution"("sourceAssetId", "createdAt");
CREATE UNIQUE INDEX "BusinessAllocation_attributionId_recipient_key" ON "BusinessAllocation"("attributionId", "recipient");
CREATE INDEX "BusinessAllocation_recipient_status_dueAt_idx" ON "BusinessAllocation"("recipient", "status", "dueAt");
CREATE INDEX "BusinessAllocation_beneficiaryReference_status_idx" ON "BusinessAllocation"("beneficiaryReference", "status");

ALTER TABLE "BusinessDistrict" ADD CONSTRAINT "BusinessDistrict_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAffiliate" ADD CONSTRAINT "BusinessAffiliate_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "BusinessDistrict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessMediaAsset" ADD CONSTRAINT "BusinessMediaAsset_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "BusinessDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessMediaAsset" ADD CONSTRAINT "BusinessMediaAsset_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "BusinessAffiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "BusinessDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "BusinessAffiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "BusinessMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_officeEventId_fkey" FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAttribution" ADD CONSTRAINT "BusinessAttribution_officeEventId_fkey" FOREIGN KEY ("officeEventId") REFERENCES "OfficeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessAttribution" ADD CONSTRAINT "BusinessAttribution_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "BusinessDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAttribution" ADD CONSTRAINT "BusinessAttribution_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "BusinessAffiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAttribution" ADD CONSTRAINT "BusinessAttribution_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "BusinessMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessAllocation" ADD CONSTRAINT "BusinessAllocation_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "BusinessAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
