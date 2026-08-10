import { z } from "zod";

export const SERVICE_CATEGORY_OPTIONS = [
  { value: "BODY", label: "Massage Body" },
  { value: "FOOT", label: "Massage chân" },
  { value: "NECK_SHOULDER", label: "Cổ vai gáy" },
  { value: "HEAD_SPA", label: "Chăm sóc đầu" },
  { value: "THERAPY", label: "Trị liệu" },
  { value: "COMBO", label: "Combo" },
  { value: "OFFICE", label: "Tâm An Business" },
] as const;

export const serviceMutationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1200),
  category: z.enum(["BODY", "FOOT", "NECK_SHOULDER", "HEAD_SPA", "THERAPY", "COMBO", "OFFICE"]),
  durationMin: z.number().int().min(5).max(480),
  basePrice: z.number().int().min(0).max(100_000_000),
  therapistFee: z.number().int().min(0).max(100_000_000),
  suggestedTip: z.number().int().min(0).max(100_000_000),
  imageUrl: z.union([z.literal(""), z.string().trim().url().max(500)]).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
  isOnline: z.boolean(),
}).superRefine((value, context) => {
  if (!value.isActive && value.isOnline) {
    context.addIssue({
      code: "custom",
      message: "Dịch vụ đã ngừng hoạt động không thể tiếp tục nhận lịch online.",
      path: ["isOnline"],
    });
  }
});

export type ServiceMutationInput = z.infer<typeof serviceMutationSchema>;

export function serviceCategoryLabel(category: string) {
  return SERVICE_CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? category;
}
