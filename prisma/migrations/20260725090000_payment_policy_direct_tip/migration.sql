UPDATE "SystemSetting"
SET "description" = 'Cọc nền tảng bằng 10% giá trị Bill ban đầu trước ưu đãi; phần còn lại bằng 90% giá trị ban đầu trừ ưu đãi.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'booking.deposit_percent';

UPDATE "SystemSetting"
SET "description" = 'Cọc nền tảng bằng 10% giá trị báo giá ban đầu gồm phí di chuyển trước ưu đãi; phần còn lại bằng giá trị sau ưu đãi trừ tiền cọc.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'business.deposit_percent';

UPDATE "SystemSetting"
SET "description" = 'Chỉ dùng để đối soát dữ liệu Tip lịch sử. Tip mới hoàn toàn tùy tâm, khách trao trực tiếp cho KTV và không đi qua Bill dịch vụ.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'finance.tip_payout_time';
