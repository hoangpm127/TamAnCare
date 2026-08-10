"use client";

import { useEffect } from "react";
import packageMetadata from "@/package.json";
import { activateInstalledReferralAttribution } from "@/lib/referral-attribution";
import { adminLandingPath, type AdminRole } from "@/lib/admin-auth";
import { isAdminWorkspacePath, preferredAdminRoute, prefersAdminWorkspace, rememberAdminWorkspace } from "@/lib/admin-workspace";

const RELOAD_KEY = `tam-an-pwa-reloaded:${packageMetadata.version}`;

export function PwaRegistration() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    // Keep an active customer's long-lived, HttpOnly session fresh whenever the
    // website or installed PWA is opened. The endpoint only renews periodically,
    // so regular launches do not create a database write on every visit.
    void fetch("/api/customer-auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => undefined);

    if (isAdminWorkspacePath(window.location.pathname)) rememberAdminWorkspace(window.location.pathname);
    if (standalone && window.location.pathname === "/" && prefersAdminWorkspace()) {
      void fetch("/api/admin-auth/session", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          const account = payload?.account as { role?: AdminRole } | undefined;
          if (!account?.role) return;
          const destination = preferredAdminRoute(account.role) || adminLandingPath(account.role);
          if (destination !== window.location.pathname) window.location.replace(destination);
        })
        .catch(() => undefined);
    }
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
