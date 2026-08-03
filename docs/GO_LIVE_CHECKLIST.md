# Checklist chạy thật

## Bắt buộc trước khi nhận tiền thật

- PostgreSQL managed riêng cho production; backup tự động và diễn tập restore đạt yêu cầu.
- Cấu hình `RATE_LIMIT_SECRET`, `CRON_SECRET`, `SEPAY_WEBHOOK_SECRET`, danh sách tài khoản nhận và cookie HTTPS bằng secret mới; không dùng lại token đã gửi qua hội thoại.
- Cấu hình webhook SePay production, kiểm tra chữ ký, tài khoản nhận, giao dịch lệch tiền và quy trình hoàn tiền.
- Đổi toàn bộ mật khẩu seed; cấu hình khóa MFA riêng, enrollment Owner/Quản lý, lưu mã khôi phục ngoại tuyến rồi bật `ADMIN_MFA_ENFORCEMENT=required-management`.
- Chọn chính sách lưu/retention chứng từ; ảnh hiện được upload thật vào PostgreSQL, giới hạn 5 MB và phân quyền theo cơ sở. Khi khối lượng lớn, chuyển byte ảnh sang object storage có URL ngắn hạn và quét mã độc.
- Cấu hình khóa AI riêng ở Railway, chạy bộ ảnh bill đại diện để đo độ chính xác; Admin vẫn phải xác nhận dữ liệu OCR trước khi hạch toán.
- Thiết lập kênh Zalo/SMS/email, mẫu tin được duyệt và cơ chế opt-in/opt-out.
- Kết nối gateway OTP SMS/Zalo, kiểm tra gửi thật, timeout, gửi lại, mã sai/hết hạn/dùng lại và cảnh báo khôi phục; không bật mã test ở production.
- Bổ sung tên pháp nhân, mã số thuế, địa chỉ, email/số điện thoại tiếp nhận khiếu nại và yêu cầu dữ liệu; luật sư/người phụ trách dữ liệu phê duyệt Điều khoản, Chính sách riêng tư, cọc/đổi lịch/no-show, Affiliate và thông tin Nhà đầu tư.
- Hoàn thành hồ sơ xử lý dữ liệu, danh sách nhà cung cấp/chuyển dữ liệu, lịch lưu–xóa từng nhóm dữ liệu, quy trình quyền chủ thể dữ liệu và thông báo sự cố; ba trang chính sách hiện vẫn là bản dự thảo.
- Thực hiện thủ tục thông báo website/ứng dụng thương mại điện tử với cơ quan có thẩm quyền nếu mô hình vận hành thuộc diện áp dụng.
- Kiểm thử phân quyền, tải đồng thời, webhook replay, khôi phục backup và kiểm thử trên thiết bị thật.

## Cổng chất lượng kỹ thuật

```bash
npm run db:deploy
npm run typecheck
npm run lint
npm run build
npm run test:core
npm run test:expenses
npm run test:refunds
npm run test:security
npm run prod:readiness
```

Chỉ triển khai khi migration đi lên thành công, `/api/health` trả `200`, test lõi sạch và có phương án rollback phiên bản ứng dụng lẫn CSDL.
