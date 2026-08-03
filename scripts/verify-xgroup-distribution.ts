import assert from "node:assert/strict";
import { BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "../lib/business-distribution";

const totalRate = Object.values(BUSINESS_DISTRIBUTION_RATES).reduce((sum, value) => sum + value, 0);
assert.equal(totalRate, 10_000, "Tỷ lệ phân bổ phải đủ 100% GMV.");

const annual = calculateBusinessDistribution(52_200_000_000);
assert.equal(annual.KTV_DIRECT, 31_320_000_000);
assert.equal(annual.TEAM_LEADER, 2_610_000_000);
assert.equal(annual.XGROUP_PLATFORM, 10_440_000_000);
assert.equal(annual.DISTRICT_DIRECTOR, 2_610_000_000);
assert.equal(annual.DIRECT_AFFILIATE, 5_220_000_000);
assert.equal(annual.deliveryTeamAmount, 33_930_000_000);
assert.equal(annual.platformAndDistributionAmount, 18_270_000_000);

for (const gross of [0, 1, 99, 1_150_000, 52_200_000_001]) {
  const split = calculateBusinessDistribution(gross);
  const allocated = split.KTV_DIRECT + split.TEAM_LEADER + split.XGROUP_PLATFORM + split.DISTRICT_DIRECTOR + split.DIRECT_AFFILIATE;
  assert.equal(allocated, Math.max(0, Math.trunc(gross)), `Phân bổ phải khớp GMV ${gross}.`);
  assert.equal(split.deliveryTeamAmount + split.platformAndDistributionAmount, allocated);
}

const billOnly = calculateBusinessDistribution(1_000_000);
const voluntaryTipOutsideBill = 250_000;
assert.equal(billOnly.grossAmount, 1_000_000, "Tip không được đưa vào GMV phân bổ.");
assert.equal(billOnly.grossAmount + voluntaryTipOutsideBill, 1_250_000, "Tip chỉ dùng để đối chiếu tổng dòng tiền bên ngoài Bill.");

console.log("Xgroup distribution verified: 65% delivery team, 35% platform/distribution, Tip excluded.");

