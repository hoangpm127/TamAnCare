import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  affiliateCustomerId,
  affiliateCommissionAmount,
  affiliateFinancialBreakdown,
  affiliateOwnerEligible,
  affiliateVisitEligible,
  AFFILIATE_COMMISSION_RATE_BPS,
  AFFILIATE_RECONCILIATION_DAYS,
  normalizeAffiliateCode,
} from "../lib/referral-policy";
import { safeCustomerReturnPath } from "../lib/safe-return-path";

assert.equal(AFFILIATE_COMMISSION_RATE_BPS, 1_000);
assert.equal(AFFILIATE_RECONCILIATION_DAYS, 15);
assert.equal(affiliateCommissionAmount(450_000), 45_000);
assert.deepEqual(
  affiliateFinancialBreakdown({
    grossBillAmount: 840_000,
    customerPaymentAmount: 640_000,
    welcomeDiscountAmount: 150_000,
    affiliateDiscountAmount: 50_000,
  }),
  {
    grossBillAmount: 840_000,
    welcomeDiscountAmount: 150_000,
    affiliateDiscountAmount: 50_000,
    otherDiscountAmount: 0,
    invitedCustomerBenefitAmount: 200_000,
    customerPaymentAmount: 640_000,
    inviterCommissionAmount: 64_000,
    centerNetAmount: 576_000,
  },
);
assert.equal(affiliateVisitEligible({ totalVisits: 0, lastVisitAt: null, completedAt: new Date() }), true);
assert.equal(affiliateVisitEligible({ totalVisits: 1, lastVisitAt: new Date("2026-08-01T00:00:00Z"), completedAt: new Date("2026-08-07T00:00:00Z") }), true);
assert.equal(affiliateVisitEligible({ totalVisits: 1, lastVisitAt: new Date("2026-08-01T00:00:00Z"), completedAt: new Date("2026-08-09T00:00:01Z") }), false);
assert.equal(affiliateCustomerId("AFFILIATE:customer-123"), "customer-123");
assert.equal(affiliateCustomerId("CAMPAIGN:customer-123"), null);
assert.equal(normalizeAffiliateCode("  aff_2026-01  "), "AFF_2026-01");
assert.equal(normalizeAffiliateCode("bad code"), "");
assert.equal(safeCustomerReturnPath("/booking?source=affiliate"), "/booking?source=affiliate");
assert.equal(safeCustomerReturnPath("https://malicious.example/booking"), "/tai-khoan");
assert.equal(safeCustomerReturnPath("//malicious.example/booking"), "/tai-khoan");
assert.equal(safeCustomerReturnPath("/api/customer-auth/session"), "/tai-khoan");
assert.equal(affiliateOwnerEligible({ phoneVerifiedAt: new Date() }, true), true);
assert.equal(affiliateOwnerEligible({ phoneVerifiedAt: null }, true), false);
assert.equal(affiliateOwnerEligible({ phoneVerifiedAt: null }, false), true);
assert.equal(affiliateOwnerEligible(null, false), false);
const bookingDalSource = readFileSync(new URL("../lib/server/booking-dal.ts", import.meta.url), "utf8");
const bookingRouteSource = readFileSync(new URL("../app/api/booking-groups/route.ts", import.meta.url), "utf8");
const voucherValidationSource = readFileSync(new URL("../app/api/vouchers/validate/route.ts", import.meta.url), "utf8");
assert.ok(
  bookingDalSource.includes('code: "AFF50"')
    && bookingDalSource.includes("primaryVoucherDiscount + affiliateBonusDiscount")
    && bookingDalSource.includes("appliedVoucherDiscounts"),
  "Booking Affiliate phải cộng WELCOME150 + AFF50 và lưu riêng từng VoucherUsage để đối soát.",
);
assert.ok(
  bookingRouteSource.includes("campaignCode: installedReferral?.code ?? parsed.data.campaignCode"),
  "Booking phải khôi phục nguồn Affiliate phía máy chủ sau khi lời mời đã gắn vào tài khoản.",
);
assert.ok(
  voucherValidationSource.includes('if (requestedCode === "AFF50")')
    && voucherValidationSource.includes("Bạn không cần nhập mã AFF50")
    && voucherValidationSource.includes('referralCodeAlias ? "WELCOME150" : requestedCode'),
  "AFF50 phải được tự động cộng thay vì cho khách nhập như voucher thông thường.",
);
assert.ok(
  !readFileSync(new URL("../lib/server/payment-service.ts", import.meta.url), "utf8").includes("Hoa hồng Affiliate gói"),
  "Mua gói dài hạn không được cộng hoa hồng trước khi khách hoàn tất một dịch vụ đủ điều kiện.",
);

console.log("Affiliate policy verified: owner eligibility, code normalization and reconciled three-party cash flow.");
