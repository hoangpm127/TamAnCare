export const FACILITY_STATUS_VALUES = ["ACTIVE", "MAINTENANCE", "HIDDEN"] as const;
export type FacilityStatus = (typeof FACILITY_STATUS_VALUES)[number];

export const BED_TYPE_VALUES = [
  "HEAD_SPA_BED",
  "MASSAGE_BED",
  "FOOT_CHAIR",
  "NECK_CHAIR",
  "PRIVATE_ROOM",
] as const;
export type FacilityBedType = (typeof BED_TYPE_VALUES)[number];

export const SERVICE_CATEGORY_VALUES = [
  "BODY",
  "FOOT",
  "NECK_SHOULDER",
  "HEAD_SPA",
  "THERAPY",
  "COMBO",
  "OFFICE",
] as const;
export type FacilityServiceCategory = (typeof SERVICE_CATEGORY_VALUES)[number];

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  ACTIVE: "Đang hoạt động",
  MAINTENANCE: "Bảo trì / tạm khóa",
  HIDDEN: "Ngừng sử dụng",
};

export const BED_TYPE_LABELS: Record<FacilityBedType, string> = {
  HEAD_SPA_BED: "Giường gội đầu",
  MASSAGE_BED: "Giường massage",
  FOOT_CHAIR: "Ghế massage chân",
  NECK_CHAIR: "Ghế cổ vai gáy",
  PRIVATE_ROOM: "Giường/phòng riêng",
};

export const SERVICE_CATEGORY_LABELS: Record<FacilityServiceCategory, string> = {
  BODY: "Body",
  FOOT: "Chân",
  NECK_SHOULDER: "Cổ vai gáy",
  HEAD_SPA: "Gội đầu",
  THERAPY: "Trị liệu",
  COMBO: "Combo",
  OFFICE: "Business",
};

export type FacilityLiveStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "CLEANING"
  | "MAINTENANCE";

export const FACILITY_LIVE_LABELS: Record<FacilityLiveStatus, string> = {
  AVAILABLE: "Sẵn sàng",
  RESERVED: "Đã giữ lịch",
  CHECKED_IN: "Khách đã đến",
  IN_SERVICE: "Đang phục vụ",
  CLEANING: "Đang vệ sinh",
  MAINTENANCE: "Tạm khóa",
};
