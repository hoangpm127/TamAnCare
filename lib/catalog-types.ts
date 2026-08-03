export type CatalogService = {
  id: string;
  name: string;
  slug: string;
  category: "BODY" | "FOOT" | "NECK_SHOULDER" | "HEAD_SPA" | "THERAPY" | "COMBO" | "OFFICE";
  description: string;
  durationMin: number;
  basePrice: number;
  therapistFee: number;
  popular: boolean;
};

export type CatalogBranch = {
  id: string;
  label: string;
  address: string;
  phone: string;
  seatCapacity: number;
  therapistCapacity: number;
  openTime: string;
  closeTime: string;
  lastBookingTime: string;
};

export type CatalogTherapist = {
  id: string;
  fullName: string;
  branchId: string;
  skills: string[];
  avatarUrl: string | null;
  publicBio: string | null;
  publicStrengths: string[];
  ratingAvg: number;
  servedCount: number;
  repeatCount: number;
  status: "ACTIVE" | "OFF" | "HIDDEN";
  serviceIds: string[];
};

export type CatalogVoucher = {
  code: string;
  name: string;
  description: string;
  type: "FIXED" | "PERCENT" | "GIFT_SERVICE";
  value: number;
  minSpend: number;
  expiresAt: string;
  constraint: string;
  accent: string;
  active: boolean;
};

export type CatalogPackagePlan = {
  id: string;
  name: string;
  paidSessions: number;
  bonusSessions: number;
  sessions: number;
  price: number;
  validityDays: number;
  badge: string | null;
  highlight: boolean;
  shareable: boolean;
  transferable: boolean;
  serviceId: string | null;
};

export type PublicCatalog = {
  branches: CatalogBranch[];
  services: CatalogService[];
  therapists: CatalogTherapist[];
  vouchers: CatalogVoucher[];
  packagePlans: CatalogPackagePlan[];
  depositPercent: number;
  priceNote: string;
};
