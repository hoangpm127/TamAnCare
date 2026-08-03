"use client";

import { useSyncExternalStore } from "react";
import type { BusinessCatalog } from "@/lib/business-catalog-types";

const listeners = new Set<() => void>();
let snapshot: BusinessCatalog | null = null;
let loading: Promise<void> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && !loading) {
    loading = fetch("/api/business-catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải cấu hình Business.");
        snapshot = await response.json() as BusinessCatalog;
        listeners.forEach((item) => item());
      })
      .catch(() => {})
      .finally(() => { loading = null; });
  }
  return () => listeners.delete(listener);
}

export function useBusinessCatalog() {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}
