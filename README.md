# Tâm An Center

Web app/PWA quản lý xuyên suốt khách hàng, đặt lịch, check-in, vận hành cơ sở và tài chính Tâm An Center.

## Môi trường triển khai Tâm An

- Production: `https://tamancare-production.up.railway.app`
- GitHub: `https://github.com/hoangpm127/TamAnCare`
- Railway dùng PostgreSQL riêng và chỉ áp dụng migration bằng `npm run db:deploy`; tuyệt đối không chạy seed trên production.
- OTP, SePay, Google và Facebook chỉ được bật sau khi có bộ thông tin dành riêng cho Tâm An. Không dùng chung khóa, mẫu SMS hoặc tài khoản nhận tiền của Tuệ Tâm.

## Chạy bản demo hiện tại

Bản demo trong workspace dùng PostgreSQL tương thích qua PGlite và lưu dữ liệu tại `.pglite-data`.

```bash
npm install
npm run db:generate
npm run demo
```

Mở `http://localhost:3000`. Trên điện thoại cùng Wi-Fi, mở địa chỉ IPv4 của máy tính ở cổng `3000`.

Nếu tạo lại cơ sở dữ liệu demo từ đầu:

```bash
npm run db:start:demo
npx prisma db push
npm run db:seed
```

Sau đó chạy `npm run dev` ở terminal khác.

## Tài khoản nội bộ

Mật khẩu không được lưu trong mã nguồn. Với CSDL demo cục bộ, sao chép `.env.example`, đặt các biến `SEED_*_PASSWORD` bằng mật khẩu riêng và xác nhận biến `ALLOW_DESTRUCTIVE_SEED` trước khi chạy seed. Seed sẽ xóa toàn bộ dữ liệu trong CSDL đích nên tuyệt đối không chạy trên production.

## Quy tắc nghiệp vụ đã nối

- Tâm An Center mở cửa 08:00–22:00 hằng ngày; khung nhận lịch cuối dự kiến 21:00 và còn phụ thuộc thời lượng dịch vụ.
- Mỗi cơ sở có 18 giường gồm 3 giường gội, 6 giường Foot và 9 giường Body; mỗi cơ sở đang cấu hình 8 KTV.
- Cọc bằng 10% tổng bill sau ưu đãi.
- Mỗi khách được đổi lịch miễn phí một lần/tháng; lần sau mất cọc cũ và cần cọc lại.
- No-show có chính sách theo tháng và thông báo nhắc quay lại.
- Tiền khách chuyển vượt giá dịch vụ được ghi riêng là Tip KTV, không cộng vào doanh thu bill; Tip được lập lịch chi cuối ngày.
- Khách không cần đăng nhập vẫn xem và đặt lịch; tạo tài khoản lần đầu nhận quyền lợi `WELCOME100` trị giá 100.000đ.
- Đăng ký và booking online bắt buộc xác nhận đúng phiên bản Điều khoản, Chính sách bảo vệ dữ liệu và Chính sách đặt lịch; bằng chứng được lưu theo khách, phiên truy cập, booking, thời điểm và hàm băm tài liệu. Tiếp thị là lựa chọn riêng có thể rút lại trong Tài khoản.
- Chủ hệ thống xem toàn bộ; quản lý chỉ thao tác cơ sở phụ trách; lễ tân không được xem tài chính hoặc ghi chi; tài khoản KTV được tách vai trò riêng.
- Chi hệ thống được phân bổ động theo tỷ trọng sức chứa đang hoạt động của từng cơ sở.

## Kiểm tra trước khi bàn giao

```bash
npm run typecheck
npm run lint
npm run build
npm run test:core
npm run test:expenses
npm run test:refunds
npm run test:security
```

## Chuẩn bị UAT

Kiểm tra cấu hình và dữ liệu bằng `npm run uat:readiness`. Sau khi đã đặt `APP_ENV=uat`, hai số điện thoại kiểm thử và biến xác nhận theo `.env.example`, tạo bộ tài khoản không phá dữ liệu bằng `npm run uat:accounts`. Hướng dẫn đầy đủ nằm trong `docs/UAT_FIELD_TEST.md`; tệp mật khẩu một lần sinh trong `artifacts/` bị Git bỏ qua và phải xóa sau khi bàn giao.

## Khi chuyển sang chạy thật

Cần dùng PostgreSQL managed, cấu hình toàn bộ secret production, tài khoản nhận và webhook SePay thật; đánh giá AI đọc bill trên dữ liệu đại diện; kết nối kênh Zalo/SMS/email; thiết lập job bảo trì, giám sát, sao lưu và kiểm thử bảo mật–tải–phục hồi. Ảnh bill hiện đã được lưu thật trong PostgreSQL, có phân quyền và chống dùng lại; khi lưu lượng lớn nên chuyển phần byte ảnh sang object storage chuyên dụng. Ba tài liệu pháp lý trong app hiện là bản dự thảo, chưa được dùng để nhận tiền thật cho tới khi bổ sung pháp nhân/đầu mối và được phê duyệt. Toàn bộ migration nằm trong `prisma/migrations/`.
