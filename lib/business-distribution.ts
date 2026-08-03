export const BUSINESS_DISTRIBUTION_RATES = {
  KTV_DIRECT: 6000,
  TEAM_LEADER: 500,
  XGROUP_PLATFORM: 2000,
  DISTRICT_DIRECTOR: 500,
  DIRECT_AFFILIATE: 1000,
} as const;

export type BusinessDistributionRecipient = keyof typeof BUSINESS_DISTRIBUTION_RATES;

export type BusinessDistributionBreakdown = Record<BusinessDistributionRecipient, number> & {
  grossAmount: number;
  deliveryTeamAmount: number;
  platformAndDistributionAmount: number;
};

/**
 * Phân bổ GMV Business theo chính sách 65/35. Tip luôn nằm ngoài grossAmount.
 * Phần làm tròn (tối đa vài đồng) được dồn vào nền tảng để tổng luôn khớp GMV.
 */
export function calculateBusinessDistribution(grossAmount: number): BusinessDistributionBreakdown {
  const safeGross = Math.max(0, Math.trunc(grossAmount));
  const ktvDirect = Math.floor(safeGross * BUSINESS_DISTRIBUTION_RATES.KTV_DIRECT / 10_000);
  const teamLeader = Math.floor(safeGross * BUSINESS_DISTRIBUTION_RATES.TEAM_LEADER / 10_000);
  const districtDirector = Math.floor(safeGross * BUSINESS_DISTRIBUTION_RATES.DISTRICT_DIRECTOR / 10_000);
  const directAffiliate = Math.floor(safeGross * BUSINESS_DISTRIBUTION_RATES.DIRECT_AFFILIATE / 10_000);
  const xgroupPlatform = safeGross - ktvDirect - teamLeader - districtDirector - directAffiliate;

  return {
    grossAmount: safeGross,
    KTV_DIRECT: ktvDirect,
    TEAM_LEADER: teamLeader,
    XGROUP_PLATFORM: xgroupPlatform,
    DISTRICT_DIRECTOR: districtDirector,
    DIRECT_AFFILIATE: directAffiliate,
    deliveryTeamAmount: ktvDirect + teamLeader,
    platformAndDistributionAmount: xgroupPlatform + districtDirector + directAffiliate,
  };
}

export const BUSINESS_DISTRIBUTION_LABELS: Record<BusinessDistributionRecipient, string> = {
  KTV_DIRECT: "KTV trực tiếp",
  TEAM_LEADER: "KTV trưởng đoàn",
  XGROUP_PLATFORM: "Nền tảng Xgroup",
  DISTRICT_DIRECTOR: "Giám đốc phân phối cấp Quận",
  DIRECT_AFFILIATE: "Affiliate trực tiếp",
};

