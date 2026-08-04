export const AFFILIATE_SOURCE_PREFIX = "AFFILIATE:";
export const AFFILIATE_COMMISSION_RATE_BPS = 1_000;
export const AFFILIATE_RETURN_WINDOW_DAYS = 7;
export const AFFILIATE_RECONCILIATION_DAYS = 15;

export function affiliateCommissionAmount(revenueAmount: number) {
  return Math.max(0, Math.round(Math.max(0, revenueAmount) * AFFILIATE_COMMISSION_RATE_BPS / 10_000));
}

export function affiliateVisitEligible(input: {
  totalVisits: number;
  lastVisitAt: Date | null;
  completedAt: Date;
}) {
  if (input.totalVisits === 0) return true;
  if (!input.lastVisitAt) return false;
  const elapsed = input.completedAt.getTime() - input.lastVisitAt.getTime();
  return elapsed >= 0 && elapsed <= AFFILIATE_RETURN_WINDOW_DAYS * 24 * 60 * 60_000;
}

export function affiliateCustomerId(source: string | null | undefined) {
  if (!source?.startsWith(AFFILIATE_SOURCE_PREFIX)) return null;
  const customerId = source.slice(AFFILIATE_SOURCE_PREFIX.length).trim();
  return customerId || null;
}

export function affiliateOwnerEligible(
  owner: { phoneVerifiedAt: Date | null } | null,
  verificationRequired: boolean,
) {
  return Boolean(owner && (!verificationRequired || owner.phoneVerifiedAt));
}

export function normalizeAffiliateCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9_-]{4,80}$/.test(code) ? code : "";
}
