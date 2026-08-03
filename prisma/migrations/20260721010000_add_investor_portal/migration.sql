-- Extend the authenticated back-office roles with a read-only investor role.
ALTER TYPE "UserRole" ADD VALUE 'INVESTOR';

CREATE TYPE "InvestorDistributionStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "InvestorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investedAmount" INTEGER NOT NULL,
    "ownershipPercent" DOUBLE PRECISION NOT NULL,
    "profitSharePercent" DOUBLE PRECISION NOT NULL,
    "targetAnnualReturn" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "startDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorAllocation" (
    "id" TEXT NOT NULL,
    "investorProfileId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "allocatedCapital" INTEGER NOT NULL,
    "ownershipPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestorAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestorDistribution" (
    "id" TEXT NOT NULL,
    "investorProfileId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InvestorDistributionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestorDistribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorProfile_userId_key" ON "InvestorProfile"("userId");
CREATE UNIQUE INDEX "InvestorAllocation_investorProfileId_branchId_key" ON "InvestorAllocation"("investorProfileId", "branchId");
CREATE INDEX "InvestorAllocation_branchId_idx" ON "InvestorAllocation"("branchId");
CREATE INDEX "InvestorDistribution_investorProfileId_periodEnd_idx" ON "InvestorDistribution"("investorProfileId", "periodEnd");

ALTER TABLE "InvestorProfile" ADD CONSTRAINT "InvestorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestorAllocation" ADD CONSTRAINT "InvestorAllocation_investorProfileId_fkey" FOREIGN KEY ("investorProfileId") REFERENCES "InvestorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestorAllocation" ADD CONSTRAINT "InvestorAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestorDistribution" ADD CONSTRAINT "InvestorDistribution_investorProfileId_fkey" FOREIGN KEY ("investorProfileId") REFERENCES "InvestorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
