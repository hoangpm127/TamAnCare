import { useSyncExternalStore } from "react";

const STORAGE_KEY = "tam-an-referral-attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();

type StoredAttribution = {
  code: string;
  capturedAt: string;
  expiresAt: string;
};

function normalizeCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{4,80}$/.test(code) ? code : "";
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  // Tương thích với mã chuỗi đã lưu trước khi bổ sung thời hạn attribution.
  const legacyCode = normalizeCode(raw);
  if (legacyCode) return legacyCode;
  try {
    const stored = JSON.parse(raw) as Partial<StoredAttribution>;
    const code = normalizeCode(stored.code ?? "");
    const expiresAt = new Date(stored.expiresAt ?? "").getTime();
    return code && Number.isFinite(expiresAt) && expiresAt > Date.now() ? code : null;
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useReferralAttribution() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setReferralAttribution(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const capturedAt = new Date();
  const attribution: StoredAttribution = {
    code: normalized,
    capturedAt: capturedAt.toISOString(),
    expiresAt: new Date(capturedAt.getTime() + ATTRIBUTION_TTL_MS).toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  notify();
}
