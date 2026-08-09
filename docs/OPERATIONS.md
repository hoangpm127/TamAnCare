# Vận hành Tâm An Center

## Giám sát

- Railway kiểm tra liveness tại `GET /api/health/live`; endpoint chỉ trả `200` khi ứng dụng kết nối được PostgreSQL.
- Giám sát vận hành dùng `GET /api/health`; trong `APP_ENV=production`, endpoint trả `503 degraded` nếu heartbeat maintenance quá 15 phút dù web và CSDL vẫn còn truy cập được. Test/dev vẫn trả trạng thái `degraded` trong JSON nhưng không bị chặn chỉ vì chưa chạy cron.
- Cảnh báo nên kích hoạt khi health check lỗi liên tiếp, tỷ lệ HTTP 5xx tăng, webhook SePay vào hàng `REVIEW/UNMATCHED`, hoặc Tip quá hạn chưa xác nhận chi.
- Không ghi token, mật khẩu, toàn bộ số điện thoại hoặc payload nhạy cảm vào log ứng dụng.

## Tác vụ định kỳ

Gọi `POST /api/jobs/maintenance` với header `Authorization: Bearer $CRON_SECRET` mỗi 5 phút. Tác vụ:

- Railway cron phải dùng biểu thức `*/5 * * * *`; tần suất ngắn hơn 5 phút không được Railway hỗ trợ và có thể khiến cron không được áp dụng vào deployment.

- giải phóng booking quá 15 phút chưa đối soát cọc;
- xóa phiên đăng nhập và quyền truy cập đã hết hạn;
- dọn bộ đếm rate-limit cũ;
- xóa ảnh bill đã tải nhưng không được dùng sau 24 giờ;
- nhắc Admin/Quản lý về Tip KTV đến hạn.

## Chứng từ chi phí và AI

- Ảnh JPG/PNG/WEBP tối đa 5 MB được kiểm tra chữ ký tệp, băm SHA-256, lưu trong PostgreSQL và chỉ Owner/Quản lý đúng cơ sở được xem.
- Ảnh trùng chứng từ đã hạch toán phải được xác nhận rõ ràng; cùng một bản ghi chứng từ không thể dùng lại.
- Nếu có `OPENAI_API_KEY`, hệ thống dùng `OPENAI_EXPENSE_MODEL` để trích xuất dữ liệu có cấu trúc và đặt trạng thái chờ Admin kiểm tra. Request đặt `store: false`.
- Nếu AI chưa cấu hình, lỗi hoặc hết thời gian chờ, ảnh vẫn được giữ và chuyển sang nhập thủ công. Không tự tạo số tiền, nhà cung cấp hay độ tin cậy.
- Cần theo dõi chi phí API, tỷ lệ đọc đúng và tỷ lệ Admin sửa kết quả trước khi cho phép dùng rộng rãi.

Tác vụ không tự đánh dấu Tip là đã trả. Admin hoặc Quản lý chỉ bấm chốt sau khi tiền mặt/chuyển khoản thực tế đã được thực hiện.

## Phiên bản chính sách và consent

- Nội dung Điều khoản, Chính sách bảo vệ dữ liệu, Chính sách đặt lịch và thông báo tiếp thị nằm trong `lib/server/legal-documents.ts`; mỗi thay đổi nội dung phải tăng phiên bản.
- Hệ thống băm nội dung SHA-256 ở phía server và lưu `ConsentRecord` cùng khách, phiên khách, booking, nguồn, thời điểm, IP/trình duyệt đã băm.
- Điều khoản/quyền riêng tư là bắt buộc khi tạo tài khoản. Booking online ghi riêng Điều khoản, quyền riêng tư và chính sách đặt lịch. Nhân viên nhập booking tại quầy không được giả lập consent online.
- Tiếp thị là lựa chọn độc lập; khách có thể bật/tắt tại Tài khoản. Khi rút lại, lần đồng ý trước được đóng bằng `withdrawnAt` và quyết định mới được lưu thành một bản ghi lịch sử.
- Không sửa ngược nội dung của một phiên bản đã có consent. Tạo phiên bản mới và thiết kế luồng xin đồng ý lại nếu thay đổi trọng yếu.

## Nhận diện khách hàng và OTP dự phòng

- Cấu hình vận hành hiện tại ưu tiên khách trung tuổi: tạo hồ sơ bằng họ tên và số điện thoại, không yêu cầu mật khẩu hoặc OTP. Giữ `PHONE_VERIFICATION_REQUIRED=false`, `PHONE_VERIFICATION_ON_SIGNUP_REQUIRED=false` và `OTP_PROVIDER=DISABLED`.
- Mỗi số điện thoại chỉ tạo được một hồ sơ. Voucher lần đầu và đối soát Affiliate phải được lễ tân kiểm tra thêm bằng lịch sử phục vụ và nhận diện khách trực tiếp tại cơ sở; trường hợp nghi ngờ được chuyển quản lý xác nhận trước khi ghi nhận quyền lợi hoặc chi hoa hồng.
- Phiên hồ sơ trên thiết bị có hiệu lực 180 ngày. Khuyến nghị khách liên kết Google hoặc Facebook ngay sau khi tạo hồ sơ để đăng nhập lại khi đổi điện thoại; nếu chưa liên kết, lễ tân hỗ trợ khôi phục tại cơ sở.
- SMS OTP được giữ làm phương án nâng cấp sau, không phải điều kiện ra mắt hiện tại.
- Mã xác minh số điện thoại gồm 6 số, hết hạn sau 5 phút, tối đa 5 lần thử. Bằng chứng xác minh chỉ dùng một lần và hết hạn sau 10 phút.
- Cấu hình ra mắt khuyến nghị: `OTP_PROVIDER=ESMS`, `ESMS_SMS_TYPE=8`, `ESMS_SANDBOX=false`; giữ trống `ESMS_BRANDNAME`. Tin loại 8 dùng nội dung OTP trung tính, không giả lập Brandname. Khi Brandname được duyệt, đổi `ESMS_SMS_TYPE=2` và đặt `ESMS_BRANDNAME=TAMANCARE` mà không đổi luồng ứng dụng.
- Phương án ra mắt nhanh: `OTP_PROVIDER=SPEEDSMS`, `SPEEDSMS_SMS_TYPE=2` và `SPEEDSMS_ACCESS_TOKEN`. Loại 2 dùng đầu số ngẫu nhiên; sau khi có Brandname mặc định có thể đổi sang loại 4 và đặt `SPEEDSMS_SENDER=Verify`.
- Phương án không cần Brandname: `OTP_PROVIDER=FIREBASE` cùng bộ biến `FIREBASE_PHONE_*`. Firebase Phone Auth chạy reCAPTCHA trên trình duyệt, chỉ cho phép miền production và vùng Việt Nam. Dự án mới không gắn billing có hạn mức 10 SMS/ngày; muốn tăng hạn mức phải chủ động gắn tài khoản thanh toán và đặt cảnh báo ngân sách trên Google Cloud.
- Cấu hình `ESMS_CALLBACK_URL` trỏ tới `/api/webhooks/esms` kèm token bí mật và đặt cùng token trong `ESMS_CALLBACK_TOKEN`. Phản hồi `CodeResult=100` chỉ là eSMS tiếp nhận; quyền nhập OTP chỉ mở sau khi eSMS/nhà mạng xác nhận giao thành công.
- Thứ tự bật production: cấu hình khóa eSMS, thử sandbox, đăng ký/duyệt nội dung đầu số cố định, cấu hình callback, đặt `ESMS_SANDBOX=false`, kiểm tra tin thật đúng mẫu rồi mới đặt `ESMS_TEMPLATES_APPROVED=true`. Ứng dụng sẽ không gửi eSMS production khi cờ duyệt mẫu chưa bật.
- Có thể dùng `OTP_PROVIDER=WEBHOOK` cùng `OTP_DELIVERY_WEBHOOK_URL` và `OTP_DELIVERY_WEBHOOK_TOKEN` nếu chuyển qua gateway nội bộ. Không cấu hình đồng thời hai đường gửi.
- `PHONE_OTP_TEST_CODE` chỉ chạy ngoài production. Không ghi mã OTP, API key hoặc SecretKey vào log/Git.

- API trả cùng một thông báo dù số điện thoại có hay không có tài khoản để hạn chế dò tài khoản.
- Mỗi mã gồm 8 số, hết hạn sau 10 phút, tối đa 5 lần thử, chỉ dùng một lần; mã chỉ được lưu dưới dạng HMAC và không được ghi log.
- Yêu cầu gửi lại sẽ vô hiệu hóa mã cũ. Đặt lại thành công thu hồi toàn bộ phiên khách và tạo thông báo bảo mật.
- Khôi phục mật khẩu dùng cùng nhà cung cấp đã chọn nhưng giữ mã 8 số và TTL 10 phút. `AUTH_OTP_TEST_CODE` chỉ chạy ngoài production.

## MFA cho Owner và Quản lý

- TOTP dùng chu kỳ 30 giây, chấp nhận lệch tối đa một bước thời gian và không chấp nhận lại mã đã dùng thành công.
- Secret TOTP được mã hóa AES-256-GCM bằng `MFA_ENCRYPTION_KEY` tách khỏi CSDL. Production không được dùng khóa suy ra từ secret phiên.
- Khi bật MFA, hệ thống cấp 10 mã khôi phục 80-bit; chỉ lưu HMAC, mỗi mã dùng một lần và bản rõ chỉ hiển thị ở thời điểm thiết lập.
- Đặt `ADMIN_MFA_ENFORCEMENT=required-management` sau khi cấu hình khóa. Owner/Quản lý chưa enrollment sẽ được chuyển thẳng tới màn hình thiết lập.
- Tắt MFA cần đồng thời mật khẩu hiện tại và mã TOTP mới, sau đó thu hồi toàn bộ phiên quản trị.

## Sao lưu và phục hồi

- Bật backup tự động hằng ngày và Point-in-Time Recovery trên PostgreSQL managed trước khi nhận dữ liệu thật.
- Lưu bản sao mã hóa ở tài khoản/vùng độc lập với Railway; thời hạn giữ đề xuất: 7 bản ngày, 8 bản tuần, 12 bản tháng.
- Có thể tạo bản dump bổ sung bằng `scripts/backup-postgres.ps1`.
- Phục hồi chỉ vào CSDL trống, tách biệt bằng `scripts/restore-postgres.ps1`; không chạy thẳng lên CSDL production đang phục vụ.
- Diễn tập phục hồi ít nhất mỗi quý và ghi lại RPO/RTO thực tế. Mục tiêu ban đầu: RPO ≤ 24 giờ, RTO ≤ 4 giờ; cần nâng cấp theo quy mô vận hành.

## Phản ứng sự cố

1. Khóa thao tác gây lỗi hoặc tạm ngừng webhook nếu nghi ngờ giao dịch sai.
2. Bảo toàn log, `PaymentWebhookEvent`, `AdminAuditLog` và snapshot CSDL.
3. Xác định phạm vi khách/cơ sở/giao dịch bị ảnh hưởng.
4. Khôi phục trên môi trường tách biệt, kiểm tra rồi mới chuyển traffic.
5. Thông báo cho người có trách nhiệm và khách hàng theo quy định đã được cố vấn pháp lý phê duyệt.
