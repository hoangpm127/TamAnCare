import { useSyncExternalStore } from "react";

export type CustomerNotificationType = "BOOKING" | "PROMO" | "REMINDER" | "INVITE" | "SYSTEM" | "BUSINESS";

export type MergedNotification = {
  id: string;
  type: CustomerNotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  createdAt: Date;
  read: boolean;
};

type NotificationResponse = Omit<MergedNotification, "createdAt"> & { createdAt: string };

const listeners = new Set<() => void>();
const EMPTY: MergedNotification[] = [];
let snapshot: MergedNotification[] = EMPTY;
let pollTimer: number | null = null;
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function replaceSnapshot(next: MergedNotification[]) {
  snapshot = next;
  emit();
}

export function refreshCustomerNotifications() {
  if (loading) return loading;
  loading = fetch("/api/notifications", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải thông báo.");
      const payload = await response.json() as { notifications?: NotificationResponse[] };
      replaceSnapshot((payload.notifications ?? []).map((item) => ({ ...item, createdAt: new Date(item.createdAt) })));
    })
    .catch(() => {
      // Giữ snapshot gần nhất khi thiết bị tạm mất mạng; không dựng dữ liệu giả.
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshCustomerNotifications();
    pollTimer = window.setInterval(() => void refreshCustomerNotifications(), 5000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

export function useAllNotifications() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

export function markNotificationRead(id: string) {
  replaceSnapshot(snapshot.map((item) => item.id === id ? { ...item, read: true } : item));
  void fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).then(() => refreshCustomerNotifications());
}

export function markAllNotificationsRead() {
  replaceSnapshot(snapshot.map((item) => ({ ...item, read: true })));
  void fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true }),
  }).then(() => refreshCustomerNotifications());
}
