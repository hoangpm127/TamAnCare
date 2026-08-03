# Kịch bản UAT thực địa Tâm An Center

## Mục tiêu và nguyên tắc

UAT dùng một môi trường Railway và PostgreSQL riêng, không dùng chung dữ liệu production. Chỉ dùng số điện thoại do đội Tâm An kiểm soát; mọi giao dịch ngân hàng ở vòng đầu phải là số tiền nhỏ đã thống nhất trước. Mỗi lỗi cần ghi: vai trò, thiết bị, thời điểm, cơ sở, mã booking/giao dịch đã rút gọn, ảnh màn hình và kết quả mong đợi.

## Chuẩn bị tài khoản

1. Cấu hình `APP_ENV=uat`, hai số điện thoại kiểm thử và xác nhận tạo tài khoản.
2. Chạy `npm run uat:accounts -- --output=artifacts/uat-credentials.json` từ máy quản trị đang kết nối CSDL UAT.
3. Bàn giao tệp mật khẩu qua kênh riêng; không gửi qua GitHub, issue hoặc nhóm chat đông người.
4. Owner/Quản lý đổi mật khẩu, thiết lập Authenticator và lưu mã khôi phục ngoại tuyến.
5. Kết thúc vòng test: chạy `npm run uat:accounts -- --cleanup`, sau đó xóa tệp mật khẩu.

## Ma trận kiểm thử

| Mã | Vai trò | Luồng bắt buộc | Kết quả đạt |
|---|---|---|---|
| G01 | Khách vãng lai | Quét QR từng cơ sở → chọn dịch vụ/KTV/giờ → xác nhận chính sách → tạo giữ chỗ | Booking đúng cơ sở; khách chỉ xem được booking bằng quyền truy cập của chính thiết bị |
| C01 | Khách mới | Đăng nhập → kiểm tra quyền lợi 100K → đặt lịch có voucher → đặt cọc | Ưu đãi chỉ dùng đúng điều kiện; cọc bằng 10% sau ưu đãi |
| C02 | Khách Affiliate | Mở mã giới thiệu → người mới đặt lịch → xem ghi nhận nguồn | Booking gắn đúng chiến dịch; không lộ dữ liệu khách được giới thiệu |
| C03 | Khách | Đổi lịch lần 1 và lần 2 cùng tháng | Lần 1 giữ cọc; lần 2 ghi nhận mất cọc cũ và yêu cầu cọc lại |
| C04 | Khách | Vắng mặt và đặt lại | Tăng đúng số lần no-show, nhắc khéo một lần/tháng, không phạt khách đã đến |
| R01 | Lễ tân | Tạo khách tại quầy → check-in QR/mã → phân KTV/ghế | Chỉ thấy dữ liệu cơ sở phụ trách; không xem/ghi chi phí |
| K01 | KTV | Xem ca → bắt đầu → hoàn thành dịch vụ | Chỉ thấy booking của chính KTV; không thấy báo cáo tài chính cơ sở |
| M01 | Quản lý | Xem booking, công suất, ghi chi có ảnh bill | Chỉ thao tác đúng cơ sở; chứng từ trùng được cảnh báo; số tiền cần xác nhận trước hạch toán |
| M02 | Quản lý | Tạo yêu cầu hoàn tiền | Không tự duyệt yêu cầu do chính mình tạo; trạng thái chờ Owner |
| A01 | Owner | Duyệt và hoàn tất hoàn tiền với mã ngân hàng | Không hoàn quá số có thể hoàn; có audit log; sổ cái, bill và ví đồng bộ |
| A02 | Owner | Nhận tiền dịch vụ và phần vượt bill | Doanh thu bằng giá dịch vụ; phần vượt ghi riêng Tip KTV |
| A03 | Owner | Chốt Tip cuối ngày | Tip chuyển sang đã chi đúng KTV/cơ sở; không sửa doanh thu bill |
| I01 | Nhà đầu tư | Lọc thời gian/cơ sở → mở biểu đồ và cơ hội đầu tư | Chỉ thấy cơ sở được phân bổ; số tài chính khớp báo cáo Owner trong cùng phạm vi |
| N01 | Tất cả vai trò | Phát sinh booking, thanh toán, chi, hoàn tiền, Affiliate | Chuông nhận đúng nội dung và phạm vi; lọc, đọc một tin và đọc tất cả hoạt động đúng |

## Kiểm thử giờ và năng lực

- 08:59 không cho chọn ca trước giờ mở cửa; 09:00 cho đặt nếu còn năng lực.
- 22:59 kiểm tra dịch vụ có thời lượng hợp lệ theo giờ đóng cửa.
- 23:00 chỉ cho chọn dịch vụ 60 phút; không cho 75/90/120 phút.
- Tạo đồng thời hai yêu cầu cùng KTV/phòng/ghế để xác nhận chỉ một yêu cầu giữ chỗ thành công.
- Cơ sở 1 và Cơ sở 2 đều hiển thị đúng 18 giường: 3 giường gội, 6 giường Foot, 9 giường Body; mỗi cơ sở có 8 KTV.

## Kiểm thử tiền thật có kiểm soát

- Đúng số tiền và nội dung: webhook xác nhận đúng booking.
- Đúng nội dung nhưng thiếu tiền: chuyển trạng thái cần đối soát, không tự xác nhận đủ.
- Chuyển vượt bill: dịch vụ và Tip tách riêng.
- Webhook gửi lặp: không tạo doanh thu/Tip hai lần.
- Sai tài khoản nhận hoặc sai nội dung: không tự gắn vào booking khác.
- Hoàn tiền: Manager tạo, Owner duyệt, Owner nhập mã giao dịch ngân hàng duy nhất sau khi đã chuyển thật.

## Thiết bị và bằng chứng

Kiểm tra tối thiểu một Android Chrome, một iPhone Safari/PWA, mạng Wi-Fi cơ sở và 4G/5G. Xác nhận cài ra màn hình chính, camera QR, nút quay lại, bàn phím số, vùng an toàn trên/dưới, màn hình 360–430 px và trải nghiệm khi mạng yếu. Mỗi vòng UAT cần lưu biên bản kết quả, người duyệt và danh sách lỗi còn mở.
