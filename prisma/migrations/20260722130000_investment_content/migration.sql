CREATE TABLE "InvestmentOpportunity" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "statusLabel" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "capitalNeed" INTEGER NOT NULL,
  "expressedInterestCapital" INTEGER NOT NULL DEFAULT 0,
  "minimumCommitment" INTEGER NOT NULL,
  "targetReturnRange" TEXT NOT NULL,
  "expectedOpening" TEXT NOT NULL,
  "nextUpdate" TEXT NOT NULL,
  "aiAssessment" TEXT NOT NULL,
  "highlights" TEXT[],
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentOpportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvestmentOpportunity_progress_check" CHECK ("progressPercent" >= 0 AND "progressPercent" <= 100),
  CONSTRAINT "InvestmentOpportunity_capital_check" CHECK ("capitalNeed" > 0 AND "minimumCommitment" > 0 AND "expressedInterestCapital" >= 0)
);

CREATE TABLE "InvestmentOpportunityCheck" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentOpportunityCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorBenefit" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "badge" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestorBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentOpportunity_slug_key" ON "InvestmentOpportunity"("slug");
CREATE INDEX "InvestmentOpportunity_isPublished_updatedAt_idx" ON "InvestmentOpportunity"("isPublished", "updatedAt");
CREATE INDEX "InvestmentOpportunity_status_updatedAt_idx" ON "InvestmentOpportunity"("status", "updatedAt");
CREATE INDEX "InvestmentOpportunityCheck_opportunityId_sortOrder_idx" ON "InvestmentOpportunityCheck"("opportunityId", "sortOrder");
CREATE UNIQUE INDEX "InvestorBenefit_slug_key" ON "InvestorBenefit"("slug");
CREATE INDEX "InvestorBenefit_isActive_sortOrder_idx" ON "InvestorBenefit"("isActive", "sortOrder");

ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvestmentOpportunityCheck" ADD CONSTRAINT "InvestmentOpportunityCheck_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
