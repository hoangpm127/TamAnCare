-- Convert legacy shift labels to explicit weekly schedules so every online KTV
-- is evaluated from the same source of truth. Existing configured schedules are
-- preserved exactly as entered by operations.
INSERT INTO "TherapistWeeklySchedule" (
  "id",
  "therapistId",
  "weekday",
  "startMinute",
  "endMinute",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy-', MD5(therapist."id"), '-', day."weekday"),
  therapist."id",
  day."weekday",
  CASE
    WHEN therapist."shiftLabel" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
      THEN SPLIT_PART(SPLIT_PART(therapist."shiftLabel", '-', 1), ':', 1)::INTEGER * 60
        + SPLIT_PART(SPLIT_PART(therapist."shiftLabel", '-', 1), ':', 2)::INTEGER
    ELSE SPLIT_PART(branch."openTime", ':', 1)::INTEGER * 60
      + SPLIT_PART(branch."openTime", ':', 2)::INTEGER
  END,
  CASE
    WHEN therapist."shiftLabel" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND SPLIT_PART(therapist."shiftLabel", '-', 2) = '00:00'
      THEN 1440
    WHEN therapist."shiftLabel" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
      THEN SPLIT_PART(SPLIT_PART(therapist."shiftLabel", '-', 2), ':', 1)::INTEGER * 60
        + SPLIT_PART(SPLIT_PART(therapist."shiftLabel", '-', 2), ':', 2)::INTEGER
    WHEN branch."closeTime" IN ('00:00', '24:00')
      THEN 1440
    ELSE SPLIT_PART(branch."closeTime", ':', 1)::INTEGER * 60
      + SPLIT_PART(branch."closeTime", ':', 2)::INTEGER
  END,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Therapist" therapist
JOIN "Branch" branch ON branch."id" = therapist."branchId"
CROSS JOIN GENERATE_SERIES(1, 7) AS day("weekday")
WHERE NOT EXISTS (
  SELECT 1
  FROM "TherapistWeeklySchedule" schedule
  WHERE schedule."therapistId" = therapist."id"
);
