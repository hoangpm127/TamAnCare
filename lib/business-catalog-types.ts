export type BusinessTrialPackage = {
  id: string;
  durationMin: number;
  pricePerPerson: number;
  name: string;
  description: string;
};

export type BusinessPackageTier = {
  id: string;
  name: string;
  sessionsPerMonth: number;
  discountPercent: number;
  bonusSessions: number;
  minHeadcountPerSession: number;
  maxHeadcountPerSession: number;
  perks: string[];
  highlight?: boolean;
};

export type BusinessTransportFee = {
  feePerTherapist: number;
  note: string;
};

export type BusinessDepositPolicy = {
  percent: number;
  description: string;
};

export type BusinessCatalog = {
  trialPackages: BusinessTrialPackage[];
  packageTiers: BusinessPackageTier[];
  transportFee: BusinessTransportFee;
  depositPolicy: BusinessDepositPolicy;
  accountingBranchId: string;
  demoMode: boolean;
};
