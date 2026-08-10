import { useSyncExternalStore } from "react";
import type { ReferralFriend } from "@/lib/demo-data";

export type ReferralSummary = {
  ready: boolean;
  authenticated: boolean;
  activationRequired: boolean;
  code: string;
  rewardForYou: string;
  rewardForFriend: string;
  totalEarned: number;
  monthlyEarnings: Array<{ month: string; amount: number }>;
  invitedCount: number;
  invited: ReferralFriend[];
  profile: {
    affiliateArea: string | null;
    affiliateBankName: string | null;
    affiliateBankAccount: string | null;
    affiliateBankHolder: string | null;
  } | null;
};

const EMPTY: ReferralSummary = {
  ready: false,
  authenticated: false,
  activationRequired: false,
  code: "",
  rewardForYou: "10% số tiền khách thực trả sau ưu đãi, chỉ ghi nhận khi dịch vụ hoàn tất và thanh toán đủ · đối soát 15 ngày",
  rewardForFriend: "Cài app từ link để nhận AFF50 và cộng cùng WELCOME150 trong lần dịch vụ đầu tiên đủ điều kiện",
  totalEarned: 0,
  monthlyEarnings: [],
  invitedCount: 0,
  invited: [],
  profile: null,
};
const listeners = new Set<() => void>();
let snapshot = EMPTY;
let loading: Promise<void> | null = null;
let timer: number | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function refreshReferralSummary() {
  if (loading) return loading;
  loading = fetch("/api/referrals/summary", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải Affiliate.");
      const payload = await response.json() as { authenticated?: boolean; summary?: Omit<ReferralSummary, "ready" | "authenticated"> | null };
      snapshot = payload.summary
        ? { ...payload.summary, ready: true, authenticated: true }
        : { ...EMPTY, ready: true, authenticated: Boolean(payload.authenticated) };
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
    void refreshReferralSummary();
    timer = window.setInterval(() => void refreshReferralSummary(), 5000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function useReferralSummary() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}
