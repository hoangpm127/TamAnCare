"use client";

import { useEffect } from "react";
import packageMetadata from "@/package.json";
import { activateInstalledReferralAttribution } from "@/lib/referral-attribution";

const RELOAD_KEY = `tam-an-pwa-reloaded:${packageMetadata.version}`;

export function PwaRegistration() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) void activateInstalledReferralAttribution();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      try {
        if (window.sessionStorage.getItem(RELOAD_KEY) === "1") return;
        window.sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        // A single in-memory guard still prevents a reload loop when storage is blocked.
      }
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(packageMetadata.version)}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("pwa.service_worker_registration_failed", error);
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  }, []);

  return null;
}
