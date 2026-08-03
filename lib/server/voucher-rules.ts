import "server-only";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";

type VoucherRules = {
  discountType: "FIXED" | "PERCENT" | "GIFT_SERVICE";
  discountValue: number;
  minimumSpend: number;
  maximumDiscount: number | null;
  firstVisitOnly: boolean;
  requiresAccount: boolean;
  requiresVerifiedPhone: boolean;
  minimumServiceDurationMin: number | null;
  bookingStartMinuteMin: number | null;
  bookingStartMinuteMax: number | null;
  excludeWeekend: boolean;
  validWithinDaysAfterLastVisit: number | null;
};

type VoucherContext = {
  subtotal: number;
  serviceDurations: number[];
  bookingStartTime?: string | Date | null;
  authenticated: boolean;
  phoneVerified: boolean;
  customer?: { totalVisits: number; lastVisitAt: Date | null } | null;
};

function businessTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { weekday: value("weekday"), minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

export function voucherRuleError(voucher: VoucherRules, context: VoucherContext) {
  if (context.subtotal < voucher.minimumSpend) {
    return `Hóa đơn cần đạt tối thiểu ${voucher.minimumSpend.toLocaleString("vi-VN")}đ để dùng ưu đãi này.`;
  }
  if (voucher.requiresAccount && !context.authenticated) return "Hãy đăng nhập tài khoản đủ điều kiện để dùng ưu đãi này.";
  if (voucher.requiresVerifiedPhone && phoneVerificationRequired() && !context.phoneVerified) {
    return "Hãy đăng nhập và xác minh số điện thoại một lần để dùng ưu đãi này.";
  }
  if (voucher.firstVisitOnly && context.customer && context.customer.totalVisits > 0) return "Ưu đãi chỉ áp dụng cho lần sử dụng dịch vụ đầu tiên.";
  if (voucher.minimumServiceDurationMin && context.serviceDurations.some((duration) => duration < voucher.minimumServiceDurationMin!)) {
    return `Ưu đãi chỉ áp dụng cho dịch vụ từ ${voucher.minimumServiceDurationMin} phút.`;
  }

  const bookingDate = context.bookingStartTime ? new Date(context.bookingStartTime) : null;
  if (bookingDate && !Number.isNaN(bookingDate.getTime())) {
    const local = businessTime(bookingDate);
    if (voucher.bookingStartMinuteMin !== null && local.minutes < voucher.bookingStartMinuteMin) return "Khung giờ đã chọn chưa nằm trong thời gian áp dụng ưu đãi.";
    if (voucher.bookingStartMinuteMax !== null && local.minutes >= voucher.bookingStartMinuteMax) return "Khung giờ đã chọn không còn nằm trong thời gian áp dụng ưu đãi.";
    if (voucher.excludeWeekend && ["Sat", "Sun"].includes(local.weekday)) return "Ưu đãi này không áp dụng vào Thứ 7 hoặc Chủ nhật.";
    if (voucher.validWithinDaysAfterLastVisit !== null) {
      if (!context.customer?.lastVisitAt) return "Ưu đãi này chỉ dành cho khách quay lại sau lần sử dụng gần nhất.";
      const deadline = new Date(context.customer.lastVisitAt.getTime() + voucher.validWithinDaysAfterLastVisit * 86_400_000);
      if (bookingDate > deadline) return `Lịch mới cần nằm trong ${voucher.validWithinDaysAfterLastVisit} ngày kể từ lần sử dụng gần nhất.`;
    }
  }
  return null;
}

export function calculateVoucherDiscount(voucher: Pick<VoucherRules, "discountType" | "discountValue" | "maximumDiscount"> | null, subtotal: number) {
  if (!voucher) return 0;
  const raw = voucher.discountType === "PERCENT"
    ? Math.round(subtotal * voucher.discountValue / 100)
    : voucher.discountType === "FIXED"
      ? voucher.discountValue
      : 0;
  return Math.min(subtotal, voucher.maximumDiscount === null ? raw : Math.min(raw, voucher.maximumDiscount));
}
