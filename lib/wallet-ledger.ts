import { useSyncExternalStore } from "react";

export type LedgerEntry = {
  id: string;
  label: string;
  amount: number;
  totalAmount?: number;
  depositAmount?: number;
  tipAmount?: number;
  refundAmount?: number;
  date: string;
  time: string;
  scheduledTime?: string;
  actualCheckinTime?: string;
  checkoutRequestedAt?: string;
  serviceDurationMin?: number;
  actualDurationSeconds?: number;
  therapistName?: string;
  branchLabel?: string;
  items?: { name: string; qty: number; amount: number }[];
  bookingCode?: string;
  note?: string;
  paymentStatus?: "UNPAID" | "DEPOSIT_ONLY" | "PAID_IN_FULL" | "PACKAGE_PURCHASE" | "PACKAGE_SESSION" | "REFUND" | "REFUNDED" | "PARTIALLY_REFUNDED";
  serviceStatus?: "RESERVED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "NOT_APPLICABLE";
  isBusiness?: boolean;
  packageName?: string;
};

const listeners = new Set<() => void>();
const EMPTY: LedgerEntry[] = [];
let snapshot: LedgerEntry[] = EMPTY;
let pollTimer: number | null = null;
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function refreshWalletLedger(afterCurrent = false): Promise<void> {
  if (loading) return afterCurrent ? loading.then(() => refreshWalletLedger()) : loading;
  loading = fetch("/api/customer-finance", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải Thu - Chi.");
      const payload = await response.json() as { entries?: LedgerEntry[] };
      snapshot = payload.entries ?? [];
      emit();
    })
    .catch(() => {
      // Giữ dữ liệu DB gần nhất khi thiết bị tạm mất kết nối; không chèn bill demo.
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshWalletLedger();
    pollTimer = window.setInterval(() => void refreshWalletLedger(), 5000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

export function useWalletLedger() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

export function calculateWalletTotalExpense(entries: LedgerEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function addLedgerEntry(...args: unknown[]) {
  void args;
  void refreshWalletLedger();
}
