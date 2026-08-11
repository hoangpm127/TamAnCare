import { z } from "zod";

export const availabilitySchema = z.object({
  serviceId: z.string().min(1).optional(),
  units: z.array(z.object({
    serviceId: z.string().min(1),
    people: z.coerce.number().int().min(1).max(6),
  })).min(1).max(6).optional(),
  date: z.string().min(10),
  durationMinutes: z.coerce.number().int().positive().optional(),
  therapistId: z.string().optional(),
  branchId: z.string().optional(),
  includeUnavailable: z.coerce.boolean().optional(),
}).refine((value) => Boolean(value.serviceId || value.units?.length), {
  message: "Cần có dịch vụ để kiểm tra lịch trống.",
}).refine((value) => (value.units?.reduce((sum, unit) => sum + unit.people, 0) ?? 1) <= 6, {
  message: "Một nhóm đặt lịch tối đa 6 người.",
  path: ["units"],
});

export const bookingSchema = z.object({
  bookingCode: z.string().min(8).optional(),
  serviceId: z.string().min(1),
  startTime: z.string().datetime().or(z.string().min(16)),
  therapistId: z.string().optional(),
  roomId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  nickName: z.string().optional(),
  note: z.string().optional(),
  voucherCode: z.string().optional(),
  source: z.string().optional(),
  campaignCode: z.string().optional(),
  branchId: z.string().min(1).optional(),
  depositRequested: z.boolean().optional(),
});

export const bookingGroupSchema = z.object({
  referenceCode: z.string().min(8),
  branchId: z.string().min(1),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(8),
  voucherCode: z.string().trim().optional(),
  campaignCode: z.string().trim().max(80).optional(),
  relationship: z.enum(["SELF", "FRIEND", "BOSS"]).optional(),
  careNote: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(100).optional(),
  bankCode: z.string().trim().max(30).optional(),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  acceptBookingPolicy: z.literal(true),
  units: z.array(z.object({
    bookingCode: z.string().min(8),
    serviceId: z.string().min(1),
    startTime: z.string().datetime({ offset: true }).or(z.string().min(16)),
    therapistId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    note: z.string().max(1000).optional(),
    source: z.string().optional(),
  })).min(1).max(6),
});

export const statusSchema = z
  .object({
    status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
    actorName: z.string().max(100).optional(),
    reason: z.string().trim().min(5).max(500).optional(),
    venueBranchId: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => value.status, { message: "At least one status is required" });

export const reviewSchema = z.object({
  bookingCode: z.string().min(4),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
  wantsRebook: z.coerce.boolean().optional(),
});

export const officeRegistrationSchema = z.object({
  eventCode: z.string().min(3),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  slotTime: z.string().datetime().or(z.string().min(16)),
});
