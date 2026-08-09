CREATE TABLE "TherapistWeeklySchedule" (
  "id" TEXT NOT NULL,
  "therapistId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TherapistWeeklySchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TherapistWeeklySchedule_therapistId_weekday_key"
ON "TherapistWeeklySchedule"("therapistId", "weekday");

CREATE INDEX "TherapistWeeklySchedule_weekday_isActive_idx"
ON "TherapistWeeklySchedule"("weekday", "isActive");

ALTER TABLE "TherapistWeeklySchedule"
ADD CONSTRAINT "TherapistWeeklySchedule_therapistId_fkey"
FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
