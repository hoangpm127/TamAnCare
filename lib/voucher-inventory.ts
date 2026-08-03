"use client";

import { useSyncExternalStore } from "react";
import type { VoucherInventoryItem } from "./voucher-inventory-server";

export type VoucherInventory = Record<string, VoucherInventoryItem>;

const EMPTY_INVENTORY: VoucherInventory = {};

let snapshot: VoucherInventory = EMPTY_INVENTORY;
let refreshPromise: Promise<void> | null = null;
let pollTimer: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch("/api/vouchers/inventory", { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => {
      if (data.inventory) {
        snapshot = data.inventory as VoucherInventory;
        notify();
      }
    })
    .catch(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void refresh();
  if (pollTimer === null) {
    pollTimer = window.setInterval(() => void refresh(), 10_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

export function useVoucherInventory() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY_INVENTORY);
}
