import { useSyncExternalStore } from "react";

export type UsageEntry = {
  date: string;
  time: string;
  bookingCode?: string;
  status?: "USED" | "RESERVED";
};

export type MembershipCard = {
  id: string;
  planId: string;
  planName: string;
  serviceId: string | null;
  shareable: boolean;
  badge: string | null;
  totalSessions: number;
  usedSessions: number;
  availableSessions: number;
  reservedSessions: number;
  purchasedAt: string;
  expiresAt: string;
  usageHistory: UsageEntry[];
};

const listeners = new Set<() => void>();
let snapshot: MembershipCard | null = null;
let loading: Promise<void> | null = null;
let timer: number | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function refreshMembership() {
  if (loading) return loading;
  loading = fetch("/api/customer-membership", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải gói thành viên.");
      const payload = await response.json() as { membership?: MembershipCard | null };
      snapshot = payload.membership ?? null;
      emit();
    })
    .catch(() => {
      // Giữ dữ liệu DB gần nhất khi thiết bị tạm mất kết nối.
    })
    .finally(() => { loading = null; });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshMembership();
    timer = window.setInterval(() => void refreshMembership(), 10000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function useMembership() {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}

export function activateMembership(...args: unknown[]) {
  void args;
  void refreshMembership();
}

export function consumeMembershipSession(...args: unknown[]) {
  void args;
  void refreshMembership();
}
