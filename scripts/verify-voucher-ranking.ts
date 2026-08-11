import assert from "node:assert/strict";
import { rankVoucherCandidates, type VoucherRankingCandidate, type VoucherRankingContext } from "../lib/voucher-ranking";

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

console.log("✓ Xếp hạng voucher đúng theo khung giờ, khách mới/quay lại và lịch sử WELCOME150.");
