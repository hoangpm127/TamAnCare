import { z } from "zod";
import { isTherapistLoginPhone, normalizeTherapistPhone } from "@/lib/server/therapist-account";

export const therapistPhoneSchema = z.string().trim()
  .transform(normalizeTherapistPhone)
  .refine(isTherapistLoginPhone, "Số điện thoại KTV phải gồm 10 chữ số và bắt đầu bằng 0.");

export const therapistPasswordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").max(200);

export const therapistCredentialMutationSchema = z.object({
  phone: therapistPhoneSchema,
  password: therapistPasswordSchema.optional(),
  resetPasswordToPhone: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.password && value.resetPasswordToPhone) {
    context.addIssue({
      code: "custom",
      message: "Chỉ chọn một cách đặt lại mật khẩu.",
      path: ["password"],
    });
  }
});

export const therapistWeeklyScheduleSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  isActive: z.boolean().default(true),
}).refine((value) => value.endMinute > value.startMinute, {
  message: "Giờ kết thúc phải sau giờ bắt đầu.",
  path: ["endMinute"],
});

export const therapistMutationSchema = z.object({
  branchId: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(2).max(120),
  phone: therapistPhoneSchema,
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  publicBio: z.string().trim().max(1000).optional().nullable(),
  publicStrengths: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  skills: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  serviceIds: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
  gender: z.string().trim().max(30).optional().nullable(),
  status: z.enum(["ACTIVE", "OFF", "HIDDEN"]).default("ACTIVE"),
  onlineBooking: z.boolean().default(true),
  internalNote: z.string().trim().max(1000).optional().nullable(),
  schedules: z.array(therapistWeeklyScheduleSchema).max(7).default([]),
}).superRefine((value, context) => {
  const weekdays = new Set<number>();
  for (const schedule of value.schedules) {
    if (weekdays.has(schedule.weekday)) {
      context.addIssue({ code: "custom", message: "Mỗi thứ chỉ được cấu hình một ca làm việc.", path: ["schedules"] });
      break;
    }
    weekdays.add(schedule.weekday);
  }
  if (value.status === "ACTIVE" && value.onlineBooking && !value.schedules.some((schedule) => schedule.isActive)) {
    context.addIssue({
      code: "custom",
      message: "KTV nhận lịch online phải có ít nhất một ngày làm việc.",
      path: ["schedules"],
    });
  }
});

export type TherapistMutationInput = z.infer<typeof therapistMutationSchema>;

export function scheduleShiftLabel(schedules: TherapistMutationInput["schedules"]) {
  const active = schedules.filter((item) => item.isActive);
  if (!active.length) return "Theo giờ mở cửa";
  const labels = new Set(active.map((item) => `${minuteLabel(item.startMinute)}-${minuteLabel(item.endMinute)}`));
  return labels.size === 1 ? [...labels][0] : "Theo lịch tuần";
}

function minuteLabel(value: number) {
  const normalized = value === 1440 ? 0 : value;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
