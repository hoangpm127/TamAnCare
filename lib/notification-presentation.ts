export type NotificationTone = "SUCCESS" | "PENDING" | "ATTENTION" | "INFO";

export type NotificationPresentation = {
  tone: NotificationTone;
  label: string;
  actionLabel: string;
  title: string;
  body: string;
};

const ATTENTION_PATTERNS = [
  "chưa thể",
  "không thể",
  "thất bại",
  "đã hủy",
  "bị hủy",
  "vắng hẹn",
  "quá hạn",
  "hết hạn",
  "không khớp",
  "chưa khớp",
  "lệch số tiền",
  "cần kiểm tra",
  "cần chăm sóc lại",
  "từ chối",
  "bất thường",
  "lỗi",
];

const PENDING_PATTERNS = [
  "chờ",
  "đang",
  "cần xác nhận",
  "cần duyệt",
  "cần sắp xếp",
  "sắp kết thúc",
  "sắp đến",
  "yêu cầu",
  "chưa nhận",
  "chưa hoàn tất",
  "đến hạn",
  "còn khoảng",
];

const SUCCESS_PATTERNS = [
  "hoàn tất",
  "thành công",
  "đã xác nhận",
  "đã được xác nhận",
  "đã thanh toán",
  "đã ghi nhận",
  "đã kích hoạt",
  "đã tiếp nhận",
  "đã đăng ký",
  "đã đổi",
  "đã cập nhật",
  "đã bán",
  "đã chốt",
  "sẵn sàng",
  "nhận ưu đãi",
  "chúc mừng",
];

const COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bIQ Care\b/gi, "Bộ phận sắp lịch"],
  [/\bAI\b/g, "Hệ thống sắp lịch"],
  [/\bbooking\b/gi, "lịch hẹn"],
  [/yêu cầu check[- ]?in/gi, "yêu cầu đón khách"],
  [/đã check[- ]?in/gi, "đã đến"],
  [/check[- ]?in/gi, "đón khách"],
  [/yêu cầu check[- ]?out sớm/gi, "yêu cầu kết thúc sớm"],
  [/đã check[- ]?out/gi, "đã hoàn tất dịch vụ"],
  [/check[- ]?out/gi, "hoàn tất dịch vụ"],
  [/khách đã lên giường/gi, "khách đã bắt đầu dịch vụ"],
  [/ca đang tính giờ/gi, "dịch vụ đang diễn ra"],
  [/đồng hồ đã dừng/gi, "thời gian dịch vụ đã dừng"],
  [/đóng Bill/gi, "hoàn tất hóa đơn"],
  [/\bBill\b/g, "hóa đơn"],
  [/\bKTV\b/g, "kỹ thuật viên"],
  [/\bCRM\b/g, "hồ sơ khách hàng"],
  [/\bAffiliate\b/gi, "đối tác giới thiệu"],
  [/\bGMV\b/g, "doanh thu"],
  [/\bSePay\b/g, "giao dịch ngân hàng"],
  [/đối soát (?:khoản )?cọc/gi, "xác nhận tiền cọc"],
  [/đối soát (?:phần )?(?:hóa đơn|Bill)/gi, "xác nhận hóa đơn"],
  [/đối soát thanh toán/gi, "xác nhận thanh toán"],
  [/đối soát/gi, "kiểm tra"],
  [/hạch toán/gi, "ghi nhận"],
  [/điều phối/gi, "sắp xếp"],
  [/\bAdmin\b/g, "quản lý"],
  [/\bpending\b/gi, "đang chờ"],
];

export const NOTIFICATION_TONE_STYLES = {
  SUCCESS: {
    card: "border-emerald-200 bg-emerald-50/70",
    icon: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    action: "text-emerald-700",
    darkCard: "border-emerald-300/20 bg-emerald-300/[0.07]",
    darkIcon: "bg-emerald-300/12 text-emerald-200",
    darkBadge: "bg-emerald-300/12 text-emerald-200",
  },
  PENDING: {
    card: "border-amber-200 bg-amber-50/75",
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    action: "text-amber-700",
    darkCard: "border-amber-300/20 bg-amber-300/[0.07]",
    darkIcon: "bg-amber-300/12 text-amber-200",
    darkBadge: "bg-amber-300/12 text-amber-200",
  },
  ATTENTION: {
    card: "border-rose-200 bg-rose-50/70",
    icon: "bg-rose-100 text-rose-700",
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    action: "text-rose-700",
    darkCard: "border-rose-300/20 bg-rose-300/[0.07]",
    darkIcon: "bg-rose-300/12 text-rose-200",
    darkBadge: "bg-rose-300/12 text-rose-200",
  },
  INFO: {
    card: "border-sky-200 bg-sky-50/70",
    icon: "bg-sky-100 text-sky-700",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    action: "text-sky-700",
    darkCard: "border-sky-300/20 bg-sky-300/[0.07]",
    darkIcon: "bg-sky-300/12 text-sky-200",
    darkBadge: "bg-sky-300/12 text-sky-200",
  },
} as const;

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function simplifyNotificationText(value: string) {
  const simplified = COPY_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s*·\s*/g, " · ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return /^\p{Lu}/u.test(value) && /^\p{Ll}/u.test(simplified)
    ? simplified[0].toLocaleUpperCase("vi-VN") + simplified.slice(1)
    : simplified;
}

export function notificationTone(title: string, body: string): NotificationTone {
  const normalizedTitle = simplifyNotificationText(title).toLocaleLowerCase("vi-VN");
  const normalizedAll = `${normalizedTitle} ${simplifyNotificationText(body).toLocaleLowerCase("vi-VN")}`;
  if (includesAny(normalizedTitle, ATTENTION_PATTERNS)) return "ATTENTION";
  if (includesAny(normalizedTitle, PENDING_PATTERNS)) return "PENDING";
  if (includesAny(normalizedTitle, SUCCESS_PATTERNS)) return "SUCCESS";
  if (includesAny(normalizedAll, ATTENTION_PATTERNS)) return "ATTENTION";
  if (includesAny(normalizedAll, PENDING_PATTERNS)) return "PENDING";
  if (includesAny(normalizedAll, SUCCESS_PATTERNS)) return "SUCCESS";
  return "INFO";
}

export function presentNotification(title: string, body: string): NotificationPresentation {
  const simplifiedTitle = simplifyNotificationText(title);
  const simplifiedBody = simplifyNotificationText(body);
  const tone = notificationTone(simplifiedTitle, simplifiedBody);
  const labels = {
    SUCCESS: { label: "Đã hoàn tất", actionLabel: "Xem kết quả" },
    PENDING: { label: "Đang xử lý", actionLabel: "Theo dõi" },
    ATTENTION: { label: "Cần chú ý", actionLabel: "Xem ngay" },
    INFO: { label: "Thông tin mới", actionLabel: "Xem chi tiết" },
  } as const;
  return { tone, title: simplifiedTitle, body: simplifiedBody, ...labels[tone] };
}
