import assert from "node:assert/strict";
import { rankVoucherCandidates, type VoucherRankingCandidate, type VoucherRankingContext } from "../lib/voucher-ranking";
import { hasActiveWelcomeVoucher, welcomeVoucherExpiresAt } from "../lib/welcome-voucher";

const createdAt = new Date("2026-08-11T00:00:00+07:00");

function candidate(code: string, patch: Partial<VoucherRankingCandidate> = {}): VoucherRankingCandidate {
  return {
    code,
    serviceId: null,
    bookingStartMinuteMin: null,
    bookingStartMinuteMax: null,
    inventoryAvailable: true,
    eligible: true,
    visible: true,
    createdAt,
    ...patch,
  };
}

const baseCandidates = [
  candidate("RETURN100"),
  candidate("WELCOME150"),
  candidate("BODY279", {
    serviceId: "svc-body-60",
    bookingStartMinuteMin: 10 * 60,
    bookingStartMinuteMax: 14 * 60,
  }),
];

function firstCode(context: VoucherRankingContext, candidates = baseCandidates) {
  return rankVoucherCandidates(candidates, context)[0]?.code;
}

assert.equal(firstCode({ audience: "NEW", minuteOfDay: 15 * 60, serviceIds: ["svc-body-60"] }), "WELCOME150");
assert.equal(firstCode({ audience: "RETURNING", minuteOfDay: 15 * 60, serviceIds: ["svc-body-60"] }), "RETURN100");
assert.equal(firstCode({ audience: "NEW", minuteOfDay: 10 * 60, serviceIds: ["svc-body-60"] }), "BODY279");
assert.equal(firstCode({ audience: "RETURNING", minuteOfDay: 13 * 60 + 59, serviceIds: ["svc-body-60"] }), "BODY279");
assert.equal(firstCode({ audience: "NEW", minuteOfDay: 14 * 60, serviceIds: ["svc-body-60"] }), "WELCOME150");
assert.equal(firstCode({ audience: "NEW", minuteOfDay: 10 * 60, serviceIds: ["svc-foot-60"] }), "WELCOME150");

const welcomeAlreadyUsed = baseCandidates.map((item) => item.code === "WELCOME150" ? { ...item, visible: false } : item);
assert.ok(!rankVoucherCandidates(welcomeAlreadyUsed, {
  audience: "NEW",
  minuteOfDay: 15 * 60,
  serviceIds: ["svc-body-60"],
}).some((item) => item.code === "WELCOME150"));

const bodySoldOut = baseCandidates.map((item) => item.code === "BODY279" ? { ...item, inventoryAvailable: false } : item);
assert.equal(firstCode({ audience: "NEW", minuteOfDay: 10 * 60, serviceIds: ["svc-body-60"] }, bodySoldOut), "WELCOME150");

const grantedAt = new Date("2026-08-11T08:30:00+07:00");
const expiresAt = new Date("2026-08-18T08:30:00+07:00");
const welcomeAccount = { creditBalance: 150_000, welcomeCreditGrantedAt: grantedAt };
assert.equal(welcomeVoucherExpiresAt(grantedAt)?.toISOString(), expiresAt.toISOString());
assert.equal(hasActiveWelcomeVoucher(welcomeAccount, new Date(expiresAt.getTime() - 1)), true);
assert.equal(hasActiveWelcomeVoucher(welcomeAccount, expiresAt), false);
assert.equal(hasActiveWelcomeVoucher({ ...welcomeAccount, creditBalance: 0 }, grantedAt), false);
assert.equal(hasActiveWelcomeVoucher({ ...welcomeAccount, welcomeCreditGrantedAt: null }, grantedAt), false);

console.log("✓ Xếp hạng voucher và hạn WELCOME150 7 ngày hoạt động đúng.");
