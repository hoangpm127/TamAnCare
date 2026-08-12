-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'OFF');

-- CreateTable
CREATE TABLE "FacilityFloor" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityRoom" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistAttendance" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "scheduledStartMinute" INTEGER,
    "scheduledEndMinute" INTEGER,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapistAttendance_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Room"
ADD COLUMN "facilityRoomId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Preserve every existing booking-to-bed relation while introducing the two
-- missing hierarchy levels. Existing beds are placed in an explicit holding
-- room so operators can rearrange the real floor plan without fabricated data.
INSERT INTO "FacilityFloor" ("id", "branchId", "name", "status", "sortOrder", "createdAt", "updatedAt")
SELECT 'facility-floor-' || md5("id"), "id", 'Tầng 1', 'ACTIVE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Branch";

INSERT INTO "FacilityRoom" ("id", "floorId", "name", "status", "sortOrder", "note", "createdAt", "updatedAt")
SELECT
    'facility-room-' || md5("id"),
    'facility-floor-' || md5("id"),
    'Khu hiện có',
    'ACTIVE',
    0,
    'Dữ liệu giường cũ được bảo toàn; hãy đổi tên và sắp xếp lại theo mặt bằng thực tế.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Branch";

UPDATE "Room"
SET "facilityRoomId" = 'facility-room-' || md5("branchId");

UPDATE "Branch" AS branch
SET "seatCapacity" = (
        SELECT COUNT(*)::INTEGER
        FROM "Room"
        WHERE "branchId" = branch."id" AND "status" = 'ACTIVE'
    ),
    "updatedAt" = CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "FacilityFloor_branchId_name_key" ON "FacilityFloor"("branchId", "name");
CREATE INDEX "FacilityFloor_branchId_status_sortOrder_idx" ON "FacilityFloor"("branchId", "status", "sortOrder");
CREATE UNIQUE INDEX "FacilityRoom_floorId_name_key" ON "FacilityRoom"("floorId", "name");
CREATE INDEX "FacilityRoom_floorId_status_sortOrder_idx" ON "FacilityRoom"("floorId", "status", "sortOrder");
CREATE INDEX "Room_facilityRoomId_status_sortOrder_idx" ON "Room"("facilityRoomId", "status", "sortOrder");
CREATE UNIQUE INDEX "TherapistAttendance_therapistId_workDate_key" ON "TherapistAttendance"("therapistId", "workDate");
CREATE INDEX "TherapistAttendance_branchId_workDate_status_idx" ON "TherapistAttendance"("branchId", "workDate", "status");
CREATE INDEX "TherapistAttendance_recordedByUserId_createdAt_idx" ON "TherapistAttendance"("recordedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "FacilityFloor" ADD CONSTRAINT "FacilityFloor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacilityRoom" ADD CONSTRAINT "FacilityRoom_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "FacilityFloor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_facilityRoomId_fkey" FOREIGN KEY ("facilityRoomId") REFERENCES "FacilityRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TherapistAttendance" ADD CONSTRAINT "TherapistAttendance_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TherapistAttendance" ADD CONSTRAINT "TherapistAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TherapistAttendance" ADD CONSTRAINT "TherapistAttendance_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
