/**
 * Giữ API để tương thích dữ liệu cũ. Tip không phải một dòng tiền trong Bill
 * dịch vụ và không được nền tảng tự động thu cùng tiền cơ sở.
 */
export function minimumTipForDuration(durationMin: number) {
  void durationMin;
  return 0;
}

export function minimumTipForBookings(bookings: Array<{ durationMin: number }>) {
  void bookings;
  return 0;
}

/**
 * Mức gợi ý hiển thị trong lúc phục vụ. Đây chỉ là lời nhắc để khách trao
 * trực tiếp cho KTV, hoàn toàn tách biệt với Bill và luồng thanh toán cơ sở.
 */
export function suggestedTipForDuration(durationMin: number) {
  if (durationMin >= 90) return 150_000;
  if (durationMin >= 60) return 100_000;
  return 0;
}
