UPDATE "Voucher"
SET
  "description" = 'Tặng 150.000đ cho lần đặt dịch vụ đầu tiên sau khi tạo tài khoản bằng họ tên, số điện thoại và Mã PIN Tâm An 4 số.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'WELCOME150';
