import assert from "node:assert/strict";
import {
  affiliateCustomerId,
  affiliateCommissionAmount,
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

console.log("Affiliate policy verified: owner eligibility, code normalization and 10% service-bill revenue share.");
