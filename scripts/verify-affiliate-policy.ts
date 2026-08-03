import assert from "node:assert/strict";
import {
  affiliateCustomerId,
  affiliateOwnerEligible,
  DEFAULT_AFFILIATE_COMMISSION,
  normalizeAffiliateCode,
} from "../lib/referral-policy";
import { safeCustomerReturnPath } from "../lib/safe-return-path";

assert.equal(DEFAULT_AFFILIATE_COMMISSION, 50_000);
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

console.log("Affiliate policy verified: owner identity, OTP gate, code normalization and commission baseline.");
