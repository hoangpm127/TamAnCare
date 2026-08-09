-- KTV vẫn là hồ sơ nhân sự để phân công dịch vụ, nhưng không còn là người dùng CNTT.
-- Thu hồi phiên trước rồi vô hiệu hóa toàn bộ tài khoản THERAPIST hiện hữu.
DELETE FROM "AdminSession"
WHERE "userId" IN (
  SELECT "id" FROM "User" WHERE "role" = 'THERAPIST'
);

UPDATE "User"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'THERAPIST'
  AND "isActive" = true;
