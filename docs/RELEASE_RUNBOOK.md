# Quy trình phát hành UAT và production

## Phát hành UAT

1. Xác nhận branch/commit sẽ phát hành và CSDL đích là UAT.
2. Cấu hình biến môi trường, chạy `npm run uat:readiness` và lưu kết quả.
3. Chạy `npm run db:deploy`; không chạy seed phá dữ liệu.
4. Chạy `npm run typecheck`, `npm run lint`, `npm run build`.
5. Khởi động bản production-like, xác nhận `/api/health` trả 200 rồi chạy `npm run test:flows`.
6. Tạo tài khoản bằng `npm run uat:accounts`, bàn giao mật khẩu một lần và chạy checklist thực địa.
7. Khi kết thúc vòng test, vô hiệu hóa tài khoản UAT không còn dùng và lưu biên bản.

## Phát hành production

1. Thu hồi toàn bộ token từng gửi qua hội thoại; tạo secret mới trực tiếp tại nhà cung cấp.
2. Chạy backup và xác minh khả năng tải bản backup trước khi migration.
3. Chạy `npm run prod:readiness`; không phát hành nếu còn bất kỳ mục `FAIL` nào.
4. Chạy migration theo cơ chế pre-deploy, sau đó health check và smoke test đọc dữ liệu.
5. Chỉ bật nhận tiền khi webhook, tài khoản nhận, MFA, pháp lý, giám sát, quy trình hoàn tiền và cơ chế nhận diện khách đã được ký duyệt. Khi OTP tắt, phải kiểm thử số điện thoại + Mã PIN Tâm An 4 số, khóa thử mã và quy trình lễ tân đối chiếu trực tiếp trước khi cấp lại PIN, duyệt voucher lần đầu hoặc hồ sơ nhận hoa hồng Affiliate.
6. Theo dõi 5xx, webhook không khớp, booking giữ chỗ hết hạn, Tip quá hạn và sai lệch sổ cái trong ít nhất 60 phút sau phát hành.

## Rollback

- Rollback ứng dụng về commit đã kiểm chứng nếu lỗi không liên quan schema.
- Không tự động rollback migration có thay đổi dữ liệu. Khóa chức năng bị ảnh hưởng, bảo toàn log và phục hồi trên CSDL tách biệt trước.
- Ghi thời điểm, phạm vi, người quyết định, mã phiên bản và các giao dịch cần đối soát lại.
