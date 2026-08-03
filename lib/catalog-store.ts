"use client";

import { useSyncExternalStore } from "react";
import type { PublicCatalog } from "@/lib/catalog-types";

const listeners = new Set<() => void>();
let snapshot: PublicCatalog | null = null;
let loading: Promise<void> | null = null;
let timer: number | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function refreshPublicCatalog() {
  if (loading) return loading;
  loading = fetch("/api/catalog", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải danh mục vận hành.");
      snapshot = await response.json() as PublicCatalog;
      emit();
    })
    .catch(() => {
      // Giữ snapshot gần nhất; giao diện có fallback trong lúc mạng chập chờn.
    })
    .finally(() => { loading = null; });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshPublicCatalog();
    timer = window.setInterval(() => void refreshPublicCatalog(), 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function usePublicCatalog() {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}
