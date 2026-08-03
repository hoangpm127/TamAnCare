export type BookingDraftItem = {
  name: string;
  qty: number;
  amount: number;
};

export type BookingRequestPayload = {
  bookingCode: string;
  serviceId: string;
  startTime: string;
  therapistId?: string;
  roomId?: string;
  customerName?: string;
  customerPhone?: string;
  nickName?: string;
  note?: string;
  voucherCode?: string;
  campaignCode?: string;
  depositRequested: true;
  source?: string;
  branchId: string;
};

export type BookingPaymentDraft = {
  referenceCode: string;
  createdAt: string;
  status: "AWAITING_DEPOSIT" | "PENDING_RECONCILIATION" | "CONFIRMED";
  confirmedAt?: string;
  bookingCodes: string[];
  requestPayloads: BookingRequestPayload[];
  summary: {
    serviceLabel: string;
    durationMin: number;
    therapistLabel: string;
    timeIso: string;
    subtotal: number;
    total: number;
    nickName?: string;
    depositAmount: number;
    dueAmount: number;
    discount?: number;
    voucherCode?: string;
    count: number;
    items: BookingDraftItem[];
    branchId: string;
    relationship?: "SELF" | "FRIEND" | "BOSS";
    careNote?: string;
    packageName?: string;
    customerPackageId?: string;
    policyAcceptedAt?: string;
  };
};

const STORAGE_PREFIX = "tam-an-booking-payment:";

function storageKey(referenceCode: string) {
  return `${STORAGE_PREFIX}${referenceCode}`;
}

export function saveBookingPaymentDraft(draft: BookingPaymentDraft) {
  window.localStorage.setItem(storageKey(draft.referenceCode), JSON.stringify(draft));
}

export function readBookingPaymentDraft(referenceCode: string): BookingPaymentDraft | null {
  const raw = window.localStorage.getItem(storageKey(referenceCode));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BookingPaymentDraft;
  } catch {
    return null;
  }
}

export function confirmBookingPaymentDraft(draft: BookingPaymentDraft): BookingPaymentDraft {
  const confirmed: BookingPaymentDraft = {
    ...draft,
    status: "CONFIRMED",
    confirmedAt: new Date().toISOString(),
  };
  saveBookingPaymentDraft(confirmed);
  return confirmed;
}

export function markBookingPaymentPending(draft: BookingPaymentDraft): BookingPaymentDraft {
  const pending: BookingPaymentDraft = {
    ...draft,
    status: "PENDING_RECONCILIATION",
    confirmedAt: undefined,
  };
  saveBookingPaymentDraft(pending);
  return pending;
}
