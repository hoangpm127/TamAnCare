import { z } from "zod";

const nullableId = z.union([z.string().trim().min(1).max(191), z.null()]);
const nullableDateTime = z.union([z.string().datetime({ offset: true }), z.null()]);
const nullableInteger = (minimum: number, maximum: number) => z.union([
  z.number().int().min(minimum).max(maximum),
  z.null(),
]);

export const DISCOUNT_TYPE_OPTIONS = [
  { value: "FIXED", label: "Giảm số tiền cố định" },
  { value: "PERCENT", label: "Giảm theo phần trăm" },
  { value: "GIFT_SERVICE", label: "Tặng toàn bộ dịch vụ" },
] as const;

export const voucherMutationSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1200),
  discountType: z.enum(["FIXED", "PERCENT", "GIFT_SERVICE"]),
  discountValue: z.number().int().min(0).max(100_000_000),
  minimumSpend: z.number().int().min(0).max(100_000_000),
  maximumDiscount: nullableInteger(0, 100_000_000),
  displayConstraint: z.string().trim().max(500),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  firstVisitOnly: z.boolean(),
  requiresAccount: z.boolean(),
  requiresVerifiedPhone: z.boolean(),
  minimumServiceDurationMin: nullableInteger(5, 480),
  bookingStartMinuteMin: nullableInteger(0, 1439),
  bookingStartMinuteMax: nullableInteger(1, 1440),
  excludeWeekend: z.boolean(),
  validWithinDaysAfterLastVisit: nullableInteger(1, 3650),
  validAfterDaysAfterLastVisit: nullableInteger(0, 3650),
  maxUsage: nullableInteger(1, 10_000_000),
  maxPerCustomer: nullableInteger(1, 1000),
  startsAt: nullableDateTime,
  endsAt: nullableDateTime,
  isActive: z.boolean(),
  campaignId: nullableId,
  serviceId: nullableId,
}).superRefine((value, context) => {
  if (value.discountType === "PERCENT" && (value.discountValue < 1 || value.discountValue > 100)) {
    context.addIssue({ code: "custom", message: "Mức giảm phần trăm phải từ 1 đến 100.", path: ["discountValue"] });
  }
  if (value.discountType === "FIXED" && value.discountValue < 1) {
    context.addIssue({ code: "custom", message: "Số tiền giảm phải lớn hơn 0.", path: ["discountValue"] });
  }
  if (value.bookingStartMinuteMin !== null && value.bookingStartMinuteMax !== null && value.bookingStartMinuteMin >= value.bookingStartMinuteMax) {
    context.addIssue({ code: "custom", message: "Giờ kết thúc phải sau giờ bắt đầu.", path: ["bookingStartMinuteMax"] });
  }
  if (value.validAfterDaysAfterLastVisit !== null && value.validWithinDaysAfterLastVisit !== null && value.validAfterDaysAfterLastVisit > value.validWithinDaysAfterLastVisit) {
    context.addIssue({ code: "custom", message: "Ngày bắt đầu không thể sau thời hạn áp dụng.", path: ["validAfterDaysAfterLastVisit"] });
  }
  if (value.maxUsage !== null && value.maxPerCustomer !== null && value.maxPerCustomer > value.maxUsage) {
    context.addIssue({ code: "custom", message: "Số lượt mỗi khách không thể lớn hơn tổng số lượt.", path: ["maxPerCustomer"] });
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
    context.addIssue({ code: "custom", message: "Ngày kết thúc phải sau ngày bắt đầu.", path: ["endsAt"] });
  }
});

export type VoucherMutationInput = z.infer<typeof voucherMutationSchema>;

export const packageMutationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1200),
  serviceId: nullableId,
  paidSessions: z.number().int().min(0).max(10_000),
  bonusSessions: z.number().int().min(0).max(10_000),
  validityDays: z.number().int().min(1).max(3650),
  price: z.number().int().min(0).max(1_000_000_000),
  badge: z.string().trim().max(120),
  isHighlighted: z.boolean(),
  isActive: z.boolean(),
  shareable: z.boolean(),
  transferable: z.boolean(),
}).superRefine((value, context) => {
  if (value.paidSessions + value.bonusSessions < 1) {
    context.addIssue({ code: "custom", message: "Gói cần có ít nhất 1 buổi sử dụng.", path: ["paidSessions"] });
  }
});

export type PackageMutationInput = z.infer<typeof packageMutationSchema>;

export function discountTypeLabel(value: string) {
  return DISCOUNT_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function minuteToTime(value: number | null) {
  if (value === null) return "";
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function timeToMinute(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
