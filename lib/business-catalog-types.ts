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

export type BusinessOnsiteProgram = {
  deploymentEnabled: boolean;
  priorityArea: string;
  durationOptionsMin: number[];
  priceOptions: number[];
  customPriceAllowed: boolean;
  minimumTherapistsPerSession: number;
  requiredAssets: string[];
  returnVoucher: {
    code: string;
    amount: number;
    description: string;
  };
  pilotPolicy: string;
};

export type BusinessCatalog = {
  trialPackages: BusinessTrialPackage[];
  packageTiers: BusinessPackageTier[];
  transportFee: BusinessTransportFee;
  depositPolicy: BusinessDepositPolicy;
  onsiteProgram: BusinessOnsiteProgram;
  accountingBranchId: string;
  demoMode: boolean;
};
