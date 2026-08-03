CREATE TYPE "TherapistProfileApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED');

ALTER TABLE "Therapist"
  ADD COLUMN "publicBio" TEXT,
  ADD COLUMN "publicStrengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "profileApprovalStatus" "TherapistProfileApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "proposedAvatarUrl" TEXT,
  ADD COLUMN "proposedBio" TEXT,
  ADD COLUMN "proposedStrengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "profileSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "profileReviewedAt" TIMESTAMP(3),
  ADD COLUMN "profileReviewNote" TEXT;

CREATE INDEX "Therapist_profileApprovalStatus_branchId_idx"
ON "Therapist"("profileApprovalStatus", "branchId");

-- Existing active KTV profiles are already used by customers. Keep them public
-- while future edits must pass through the new approval workflow.
UPDATE "Therapist"
SET
  "publicBio" = 'KTV được đào tạo theo tiêu chuẩn Tâm An Care, chú trọng sự chỉn chu, an toàn và trải nghiệm riêng của từng khách.',
  "publicStrengths" = "skills",
  "profileApprovalStatus" = 'APPROVED',
  "profileReviewedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'ACTIVE';
