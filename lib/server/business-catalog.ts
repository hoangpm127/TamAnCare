import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  corporatePackageTiers as defaultPackageTiers,
  corporateTransportFee as defaultTransportFee,
  corporateTrialPackages as defaultTrialPackages,
  depositPolicy as defaultDepositPolicy,
} from "@/lib/demo-data";
import type { BusinessCatalog } from "@/lib/business-catalog-types";

const trialSchema = z.array(z.object({
  id: z.string().min(2),
  durationMin: z.number().int().min(10).max(240),
  pricePerPerson: z.number().int().positive(),
  name: z.string().min(2),
  description: z.string(),
})).min(1);

const tierSchema = z.array(z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  sessionsPerMonth: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100),
  bonusSessions: z.number().int().nonnegative(),
  minHeadcountPerSession: z.number().int().positive(),
  maxHeadcountPerSession: z.number().int().positive(),
  perks: z.array(z.string()),
  highlight: z.boolean().optional(),
})).min(1);

const transportSchema = z.object({ feePerTherapist: z.number().int().nonnegative(), note: z.string() });

function configurationError(label: string): never {
  throw new Error(`Cấu hình production không hợp lệ: ${label}.`);
}

function parseJson<T>(value: string | undefined, schema: z.ZodType<T>, fallback: T, label: string) {
  if (!value) {
    if (process.env.APP_ENV === "production") return configurationError(label);
    return fallback;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Xử lý fail-closed ở dưới để production không hiển thị dữ liệu mẫu.
  }
  if (process.env.APP_ENV === "production") return configurationError(label);
  return fallback;
}

export async function getBusinessCatalog(): Promise<BusinessCatalog> {
  const keys = [
    "GLOBAL:business.trial_packages",
    "GLOBAL:business.package_tiers",
    "GLOBAL:business.transport",
    "GLOBAL:business.deposit_percent",
    "GLOBAL:business.accounting_branch_id",
  ];
  const settings = await db.systemSetting.findMany({ where: { scopeKey: { in: keys }, isActive: true } });
  const value = (key: string) => settings.find((item) => item.scopeKey === `GLOBAL:${key}`)?.value;
  const depositPercent = Number(value("business.deposit_percent"));
  const validDepositPercent = Number.isFinite(depositPercent) && depositPercent >= 0 && depositPercent <= 100;
  const accountingBranchId = value("business.accounting_branch_id");
  if (process.env.APP_ENV === "production" && !validDepositPercent) configurationError("tỷ lệ đặt cọc doanh nghiệp");
  if (process.env.APP_ENV === "production" && !accountingBranchId) configurationError("cơ sở hạch toán doanh nghiệp");
  return {
    trialPackages: parseJson(value("business.trial_packages"), trialSchema, defaultTrialPackages, "gói dùng thử doanh nghiệp"),
    packageTiers: parseJson(value("business.package_tiers"), tierSchema, defaultPackageTiers, "gói dài hạn doanh nghiệp"),
    transportFee: parseJson(value("business.transport"), transportSchema, defaultTransportFee, "phí di chuyển doanh nghiệp"),
    depositPolicy: {
      ...defaultDepositPolicy,
      percent: validDepositPercent ? depositPercent : defaultDepositPolicy.percent,
    },
    accountingBranchId: accountingBranchId || "cs1",
    demoMode: process.env.APP_ENV !== "production",
  };
}
