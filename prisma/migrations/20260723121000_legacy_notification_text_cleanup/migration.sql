-- Normalize a known legacy UAT label while preserving the underlying notification history.
UPDATE "Notification"
SET "title" = replace("title", 'Kh�ch ki?m th? WELCOME', 'Khách kiểm thử WELCOME')
WHERE "title" LIKE '%Kh�ch ki?m th? WELCOME%';
