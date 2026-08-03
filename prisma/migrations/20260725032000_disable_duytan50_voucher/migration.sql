-- Giữ dữ liệu lịch sử để đối soát các Bill cũ, nhưng ngừng hiển thị
-- và ngừng cho phép áp dụng voucher DUYTAN50 từ thời điểm triển khai.
UPDATE "Voucher"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'DUYTAN50';
