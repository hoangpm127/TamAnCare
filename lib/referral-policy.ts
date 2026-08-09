export const AFFILIATE_SOURCE_PREFIX = "AFFILIATE:";
export const AFFILIATE_COMMISSION_RATE_BPS = 1_000;
export const AFFILIATE_RETURN_WINDOW_DAYS = 7;
export const AFFILIATE_RECONCILIATION_DAYS = 15;

export function affiliateCommissionAmount(revenueAmount: number) {
  return Math.max(0, Math.round(Math.max(0, revenueAmount) * AFFILIATE_COMMISSION_RATE_BPS / 10_000));
}

export type AffiliateFinancialBreakdown = {
  grossBillAmount: number;
  welcomeDiscountAmount: number;
  affiliateDiscountAmount: number;
  otherDiscountAmount: number;
  invitedCustomerBenefitAmount: number;
  customerPaymentAmount: number;
  inviterCommissionAmount: number;
  centerNetAmount: number;
};

/**
 * Một nguồn tính duy nhất cho dòng tiền Affiliate cá nhân.
 *
 * Bill gốc = ưu đãi của khách được mời + số khách thanh toán.
 * Số khách thanh toán = hoa hồng người mời + doanh thu còn lại của Tâm An.
 * Tip không được truyền vào đây vì luôn nằm ngoài Bill và GMV.
 */
export function affiliateFinancialBreakdown(input: {
  grossBillAmount: number;
  customerPaymentAmount: number;
  welcomeDiscountAmount?: number;
  affiliateDiscountAmount?: number;
}): AffiliateFinancialBreakdown {
  const grossBillAmount = Math.max(0, Math.round(input.grossBillAmount));
  const customerPaymentAmount = Math.min(grossBillAmount, Math.max(0, Math.round(input.customerPaymentAmount)));
  const totalDiscountAmount = grossBillAmount - customerPaymentAmount;
  const welcomeDiscountAmount = Math.min(totalDiscountAmount, Math.max(0, Math.round(input.welcomeDiscountAmount ?? 0)));
  const affiliateDiscountAmount = Math.min(
    totalDiscountAmount - welcomeDiscountAmount,
    Math.max(0, Math.round(input.affiliateDiscountAmount ?? 0)),
  );
  const otherDiscountAmount = totalDiscountAmount - welcomeDiscountAmount - affiliateDiscountAmount;
  const inviterCommissionAmount = affiliateCommissionAmount(customerPaymentAmount);

  return {
    grossBillAmount,
    welcomeDiscountAmount,
    affiliateDiscountAmount,
    otherDiscountAmount,
    invitedCustomerBenefitAmount: totalDiscountAmount,
    customerPaymentAmount,
    inviterCommissionAmount,
    centerNetAmount: customerPaymentAmount - inviterCommissionAmount,
  };
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
