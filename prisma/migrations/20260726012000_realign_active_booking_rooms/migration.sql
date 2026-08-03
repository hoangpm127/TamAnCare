-- Lịch chờ/đã xác nhận từ sơ đồ cũ có thể đang trỏ vào một giường không còn
-- phù hợp với nhóm dịch vụ. Gỡ riêng các liên kết sai rồi điều phối lại theo
-- thời gian, buffer của cơ sở và nhóm giường mới; không đụng phiên đang phục vụ.
UPDATE "Booking" AS booking
SET "roomId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Service" AS service
WHERE booking."serviceId" = service."id"
  AND booking."branchId" IN ('cs1', 'cs2')
  AND booking."status" IN ('PENDING', 'CONFIRMED')
  AND booking."roomId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Room" AS room
    WHERE room."id" = booking."roomId"
      AND room."status" = 'ACTIVE'
      AND service."category" = ANY(room."suitableCategories")
  );

DO $$
DECLARE
  pending_booking RECORD;
  selected_room_id TEXT;
BEGIN
  FOR pending_booking IN
    SELECT
      booking."id",
      booking."branchId",
      booking."startTime",
      booking."endTime",
      service."category",
      branch."bufferMinutes"
    FROM "Booking" AS booking
    JOIN "Service" AS service ON service."id" = booking."serviceId"
    JOIN "Branch" AS branch ON branch."id" = booking."branchId"
    WHERE booking."branchId" IN ('cs1', 'cs2')
      AND booking."status" IN ('PENDING', 'CONFIRMED')
      AND booking."roomId" IS NULL
    ORDER BY booking."startTime" ASC, booking."createdAt" ASC
  LOOP
    selected_room_id := NULL;

    SELECT room."id"
    INTO selected_room_id
    FROM "Room" AS room
    WHERE room."branchId" = pending_booking."branchId"
      AND room."status" = 'ACTIVE'
      AND pending_booking."category" = ANY(room."suitableCategories")
      AND NOT EXISTS (
        SELECT 1
        FROM "Booking" AS conflicting_booking
        WHERE conflicting_booking."id" <> pending_booking."id"
          AND conflicting_booking."roomId" = room."id"
          AND conflicting_booking."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE')
          AND conflicting_booking."startTime" < pending_booking."endTime" + make_interval(mins => pending_booking."bufferMinutes")
          AND conflicting_booking."endTime" > pending_booking."startTime" - make_interval(mins => pending_booking."bufferMinutes")
      )
    ORDER BY room."name" ASC
    LIMIT 1;

    IF selected_room_id IS NOT NULL THEN
      UPDATE "Booking"
      SET "roomId" = selected_room_id,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = pending_booking."id";
    END IF;
  END LOOP;
END $$;
