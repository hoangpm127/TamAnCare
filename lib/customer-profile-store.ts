import { useSyncExternalStore } from "react";

export type CustomerProfile = {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  preferredPressure: "NHẸ" | "VỪA" | "MẠNH";
  healthNotes: string;
  bookingReminders: boolean;
  promotionUpdates: boolean;
  totalVisits: number;
  favoriteTherapist: string;
};

export const DEFAULT_CUSTOMER_PROFILE: CustomerProfile = {
  fullName: "",
  phone: "",
  email: "",
  birthDate: "",
  preferredPressure: "VỪA",
  healthNotes: "",
  bookingReminders: true,
  promotionUpdates: false,
  totalVisits: 0,
  favoriteTherapist: "Chưa chọn",
};

const listeners = new Set<() => void>();
let snapshot = DEFAULT_CUSTOMER_PROFILE;
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function refreshCustomerProfile() {
  if (loading) return loading;
  loading = fetch("/api/customer-profile", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải hồ sơ khách hàng.");
      const payload = await response.json() as { profile?: CustomerProfile | null };
      snapshot = payload.profile ?? DEFAULT_CUSTOMER_PROFILE;
      emit();
    })
    .catch(() => {
      // Giữ bản CSDL gần nhất trong bộ nhớ khi thiết bị tạm mất kết nối; không dựng hồ sơ demo.
    })
    .finally(() => { loading = null; });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) void refreshCustomerProfile();
  return () => listeners.delete(listener);
}

export function useCustomerProfile() {
  return useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_CUSTOMER_PROFILE);
}

export async function saveCustomerProfile(profile: CustomerProfile) {
  const response = await fetch("/api/customer-profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: profile.fullName,
      email: profile.email,
      birthDate: profile.birthDate,
      preferredPressure: profile.preferredPressure,
      healthNotes: profile.healthNotes,
      bookingReminders: profile.bookingReminders,
      promotionUpdates: profile.promotionUpdates,
    }),
  });
  const payload = await response.json() as { profile?: CustomerProfile; error?: string };
  if (!response.ok || !payload.profile) throw new Error(payload.error ?? "Không thể lưu hồ sơ khách hàng.");
  snapshot = payload.profile;
  emit();
  return snapshot;
}
