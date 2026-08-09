import { adminLandingPath, type AdminRole } from "@/lib/admin-auth";

const ADMIN_WORKSPACE_KEY = "tam-an:preferred-workspace";
const ADMIN_ROUTE_KEY = "tam-an:last-admin-route";

export function isAdminWorkspacePath(pathname: string) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname === "/therapist"
    || pathname.startsWith("/therapist/")
    || pathname === "/xgroup"
    || pathname.startsWith("/xgroup/")
    || pathname === "/bao-mat-quan-tri"
    || pathname === "/doi-mat-khau-quan-tri";
}

export function rememberAdminWorkspace(pathname: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_WORKSPACE_KEY, "admin");
    if (isAdminWorkspacePath(pathname)) window.localStorage.setItem(ADMIN_ROUTE_KEY, pathname);
  } catch {
    // The encrypted HttpOnly session remains authoritative when storage is unavailable.
  }
}

export function forgetAdminWorkspace() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_WORKSPACE_KEY);
    window.localStorage.removeItem(ADMIN_ROUTE_KEY);
  } catch {
    // Logout still revokes the server session even if browser storage is blocked.
  }
}

export function preferredAdminRoute(role: AdminRole) {
  if (typeof window === "undefined") return adminLandingPath(role);
  try {
    const preferredWorkspace = window.localStorage.getItem(ADMIN_WORKSPACE_KEY);
    const storedRoute = window.localStorage.getItem(ADMIN_ROUTE_KEY) ?? "";
    return preferredWorkspace === "admin" && isAdminWorkspacePath(storedRoute)
      ? storedRoute
      : adminLandingPath(role);
  } catch {
    return adminLandingPath(role);
  }
}

export function prefersAdminWorkspace() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_WORKSPACE_KEY) === "admin";
  } catch {
    return false;
  }
}
