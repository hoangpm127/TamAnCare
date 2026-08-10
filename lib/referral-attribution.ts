import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "tam-an-referral-attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();

type StoredAttribution = {
  code: string;
  state: "PENDING" | "ACTIVE";
  capturedAt: string;
  activatedAt?: string;
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
  try {
    const stored = JSON.parse(raw) as Partial<StoredAttribution>;
    const code = normalizeCode(stored.code ?? "");
    const expiresAt = new Date(stored.expiresAt ?? "").getTime();
    return code && stored.state === "ACTIVE" && Number.isFinite(expiresAt) && expiresAt > Date.now() ? code : null;
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useReferralAttribution() {
  const attribution = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void reconcileReferralAttribution();
  }, []);
  return attribution;
}

function readStoredAttribution() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const legacyCode = normalizeCode(raw);
  if (legacyCode) return { code: legacyCode };
  try {
    const stored = JSON.parse(raw) as Partial<StoredAttribution>;
    const code = normalizeCode(stored.code ?? "");
    return code ? stored : null;
  } catch {
    return null;
  }
}

function storeAttribution(code: string, state: "PENDING" | "ACTIVE", expiresAt?: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const capturedAt = new Date();
  const attribution: StoredAttribution = {
    code: normalized,
    state,
    capturedAt: capturedAt.toISOString(),
    ...(state === "ACTIVE" ? { activatedAt: capturedAt.toISOString() } : {}),
    expiresAt: expiresAt ?? new Date(capturedAt.getTime() + ATTRIBUTION_TTL_MS).toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  notify();
}

function clearAttribution() {
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}

async function reconcileReferralAttribution() {
  try {
    const response = await fetch("/api/referrals/install-attribution", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { state?: "ACTIVE" | "NONE"; code?: string };
    if (payload.state === "ACTIVE" && payload.code) {
      storeAttribution(payload.code, "ACTIVE");
    } else if (payload.state === "NONE" && getSnapshot()) {
      // Remove only an ACTIVE local value. A freshly captured PENDING value is
      // still needed by the install prompt before sign-up.
      clearAttribution();
    }
  } catch {
    // Offline PWAs keep their current local state until server reconciliation
    // becomes available again.
  }
}

export function pendingReferralCode() {
  return normalizeCode(String(readStoredAttribution()?.code ?? ""));
}

export async function captureReferralAttribution(code: string) {
  storeAttribution(code, "PENDING");
  const response = await fetch("/api/referrals/install-attribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CAPTURE", code }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { state?: "PENDING" | "ACTIVE"; code?: string; expiresAt?: string };
  if ((payload.state === "PENDING" || payload.state === "ACTIVE") && payload.code) {
    storeAttribution(payload.code, payload.state, payload.expiresAt);
    return { state: payload.state, code: payload.code, expiresAt: payload.expiresAt };
  }
  return null;
}

export async function activateInstalledReferralAttribution(code = pendingReferralCode()) {
  const response = await fetch("/api/referrals/install-attribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ACTIVATE", ...(code ? { code } : {}) }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { state?: "ACTIVE"; code?: string; expiresAt?: string };
  if (payload.state !== "ACTIVE" || !payload.code) return null;
  storeAttribution(payload.code, "ACTIVE", payload.expiresAt);
  return payload.code;
}
