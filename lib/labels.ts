export function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    IN_SERVICE: "Đang phục vụ",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    NO_SHOW: "Không đến",
  };
  return labels[status] ?? status;
}

export function bookingDisplayStatusLabel(status: string, depositAmount?: number) {
  if (status === "CONFIRMED" && depositAmount && depositAmount > 0) {
    return "Đã đặt chỗ - Chưa sử dụng";
  }
  return bookingStatusLabel(status);
}

export function notificationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    BOOKING: "Lịch hẹn",
    PROMO: "Ưu đãi",
    REMINDER: "Nhắc nhở",
    SYSTEM: "Hệ thống",
    BUSINESS: "Doanh nghiệp",
    INVITE: "Bạn bè mời",
  };
  return labels[type] ?? type;
}

export function billStatusLabel(status: string) {
  const labels: Record<string, string> = {
    UNUSED: "Chưa sử dụng",
    IN_SERVICE: "Đang phục vụ",
    COMPLETED: "Đã hoàn tất",
  };
  return labels[status] ?? status;
}

export function resourceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    OFF: "Nghỉ",
    HIDDEN: "Đang ẩn",
    MAINTENANCE: "Bảo trì",
    ONLINE: "Đặt online",
    OPEN: "Cần chăm sóc",
    READY: "Sẵn sàng",
    MOCK: "Mô phỏng",
    NEW: "Khách mới",
    RETURNING: "Khách quay lại",
    VIP: "Khách VIP",
  };
  return labels[status] ?? status;
}
