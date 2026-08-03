export const AFFILIATE_SOURCE_PREFIX = "AFFILIATE:";
export const DEFAULT_AFFILIATE_COMMISSION = 50_000;

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
