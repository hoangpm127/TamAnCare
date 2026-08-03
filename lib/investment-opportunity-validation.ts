import { z } from "zod";

const checkSchema = z.object({
  label: z.string().trim().min(3).max(180),
  status: z.enum(["DONE", "IN_PROGRESS", "PENDING"]),
});

export const opportunitySchema = z.object({
  type: z.enum(["NEW_BRANCH", "ACQUISITION"]),
  name: z.string().trim().min(5).max(180),
  area: z.string().trim().min(5).max(240),
  status: z.enum(["SURVEYING", "DUE_DILIGENCE", "FUNDING", "APPROVED", "ON_HOLD", "CLOSED"]),
  statusLabel: z.string().trim().min(3).max(80),
  progressPercent: z.coerce.number().int().min(0).max(100),
  capitalNeed: z.coerce.number().int().positive().max(100_000_000_000),
  expressedInterestCapital: z.coerce.number().int().min(0).max(100_000_000_000),
  minimumCommitment: z.coerce.number().int().positive().max(100_000_000_000),
  targetReturnRange: z.string().trim().min(3).max(80),
  expectedPaybackPeriod: z.string().trim().min(3).max(100),
  expectedOpening: z.string().trim().min(3).max(100),
  nextUpdate: z.string().trim().min(3).max(240),
  aiAssessment: z.string().trim().min(10).max(1_500),
  highlights: z.array(z.string().trim().min(3).max(240)).min(1).max(8),
  checks: z.array(checkSchema).min(1).max(12),
  isPublished: z.boolean().default(false),
});

// PATCH phải giữ nguyên mọi trường không được gửi lên. Ghi đè riêng
// `isPublished` để giá trị mặc định của schema tạo mới không vô tình
// biến một bản ghi đang công bố thành bản nháp.
export const opportunityUpdateSchema = opportunitySchema.partial().extend({
  isPublished: z.boolean().optional(),
  notifyInvestors: z.boolean().optional(),
});
