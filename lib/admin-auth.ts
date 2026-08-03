import type { adminSections } from "@/lib/demo-data";

export type AdminSectionSlug = keyof typeof adminSections;
export type AdminRole = "OWNER" | "BRANCH_MANAGER" | "RECEPTIONIST" | "THERAPIST" | "INVESTOR" | "XGROUP_SUPER_ADMIN" | "DISTRICT_SALES_MANAGER";

/**
 * DTO an toàn để gửi xuống trình duyệt. Tuyệt đối không bổ sung mật khẩu,
 * password hash hay bí mật xác thực vào kiểu dữ liệu này.
 */
export type AdminAccount = {
  id: string;
  displayName: string;
  title: string;
  role: AdminRole;
  branchId: string | null;
  therapistId: string | null;
  branchLabel: string;
  permissions: AdminSectionSlug[];
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  mustEnrollMfa: boolean;
};

const OWNER_PERMISSIONS: AdminSectionSlug[] = [
  "bookings",
  "calendar",
  "capacity",
  "customers",
  "therapists",
  "services",
  "rooms",
  "vouchers",
  "packages",
  "campaigns",
  "reminders",
  "office-events",
  "reports",
  "settings",
];

const BRANCH_MANAGER_PERMISSIONS: AdminSectionSlug[] = [
  "bookings",
  "calendar",
  "capacity",
  "customers",
  "therapists",
  "services",
  "rooms",
  "reminders",
  "office-events",
  "reports",
  "settings",
];

const RECEPTIONIST_PERMISSIONS: AdminSectionSlug[] = [
  "bookings",
  "calendar",
  "customers",
  "rooms",
  "reminders",
];

export function permissionsForAdminRole(role: AdminRole): AdminSectionSlug[] {
  if (role === "OWNER") return [...OWNER_PERMISSIONS];
  if (role === "BRANCH_MANAGER") return [...BRANCH_MANAGER_PERMISSIONS];
  if (role === "RECEPTIONIST") return [...RECEPTIONIST_PERMISSIONS];
  return [];
}

export function canAccessAdminSection(account: AdminAccount, section: string): section is AdminSectionSlug {
  return account.permissions.includes(section as AdminSectionSlug);
}

export function adminLandingPath(role: AdminRole) {
  if (role === "THERAPIST") return "/therapist";
  if (role === "XGROUP_SUPER_ADMIN" || role === "DISTRICT_SALES_MANAGER") return "/xgroup";
  return "/admin";
}
