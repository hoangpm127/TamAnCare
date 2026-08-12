export type AdminAffiliatePeriod = "today" | "7d" | "14d" | "30d" | "90d" | "180d" | "365d";

export type AdminAffiliateTimelineItem = {
  id: string;
  amount: number;
  occurredAt: string;
  dueAt: string;
  status: "PENDING" | "PAID";
  isOverdue: boolean;
  affiliateId: string;
  affiliateName: string;
  affiliatePhone: string;
  referredCustomerId: string | null;
  referredCustomerName: string;
  referredCustomerPhone: string;
  referenceCode: string;
  serviceLabel: string;
  branchId: string;
  branchLabel: string;
  campaignCode: string;
  paidAt: string | null;
  paidByName: string | null;
  transferReference: string | null;
  payoutNote: string | null;
};

export type AdminAffiliateInvitedCustomer = {
  id: string;
  name: string;
  phone: string;
  joinedAt: string;
  lastBookingAt: string | null;
  bookingCount: number;
  completedCount: number;
  completedRevenue: number;
  status: "REGISTERED" | "BOOKED" | "COMPLETED";
};

export type AdminAffiliateProfile = {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  joinedAt: string;
  phoneVerified: boolean;
  campaignCodes: string[];
  bank: {
    name: string | null;
    account: string | null;
    holder: string | null;
    complete: boolean;
  };
  invitedCustomers: AdminAffiliateInvitedCustomer[];
  periodEarnings: number;
  periodPending: number;
  periodPaid: number;
  periodCommissionCount: number;
};

export type AdminAffiliateReport = {
  generatedAt: string;
  range: {
    period: AdminAffiliatePeriod;
    label: string;
    from: string;
    to: string;
  };
  showPaid: boolean;
  stats: {
    pendingAmount: number;
    paidAmount: number;
    earnedAmount: number;
    overdueAmount: number;
    pendingCount: number;
    paidCount: number;
    affiliateCount: number;
    referredCustomerCount: number;
  };
  timeline: AdminAffiliateTimelineItem[];
  affiliates: AdminAffiliateProfile[];
};

export const ADMIN_AFFILIATE_PERIOD_OPTIONS: Array<{ value: AdminAffiliatePeriod; label: string }> = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "1 tuần qua" },
  { value: "14d", label: "2 tuần qua" },
  { value: "30d", label: "1 tháng qua" },
  { value: "90d", label: "3 tháng qua" },
  { value: "180d", label: "6 tháng qua" },
  { value: "365d", label: "1 năm qua" },
];
