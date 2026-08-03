export type FacilityServiceCategory =
  | "BODY"
  | "FOOT"
  | "NECK_SHOULDER"
  | "HEAD_SPA"
  | "THERAPY"
  | "COMBO"
  | "OFFICE";

export type FacilityRoomType =
  | "HEAD_SPA_BED"
  | "FOOT_CHAIR"
  | "MASSAGE_BED";

export const FACILITY_ROOM_COUNTS = {
  headSpa: 3,
  foot: 6,
  body: 9,
} as const;

export const FACILITY_SEAT_CAPACITY =
  FACILITY_ROOM_COUNTS.headSpa
  + FACILITY_ROOM_COUNTS.foot
  + FACILITY_ROOM_COUNTS.body;

export const FACILITY_BRANCHES = [
  {
    id: "cs1",
    label: "Cơ sở 1",
    address: "Số 1 Hoàng Quán Chi, Dịch Vọng, Cầu Giấy, Hà Nội",
    phone: "0896 999 631",
    seatCapacity: FACILITY_SEAT_CAPACITY,
    therapistCapacity: 8,
  },
  {
    id: "cs2",
    label: "Cơ sở 2",
    address: "A11 LK6D BCA, Nguyễn Văn Lộc, Hà Đông, Hà Nội",
    phone: "0973 557 500",
    seatCapacity: FACILITY_SEAT_CAPACITY,
    therapistCapacity: 8,
  },
] as const;

export type FacilityRoom = {
  id: string;
  branchId: string;
  name: string;
  type: FacilityRoomType;
  suitableCategories: FacilityServiceCategory[];
};

function roomNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function facilityRoomsForBranch(branchId: string): FacilityRoom[] {
  const headSpaRooms = Array.from({ length: FACILITY_ROOM_COUNTS.headSpa }, (_, index) => ({
    id: `${branchId}-seat-${roomNumber(index + 1)}`,
    branchId,
    name: `Giường gội ${roomNumber(index + 1)}`,
    type: "HEAD_SPA_BED" as const,
    suitableCategories: ["HEAD_SPA"] as FacilityServiceCategory[],
  }));
  const footRooms = Array.from({ length: FACILITY_ROOM_COUNTS.foot }, (_, index) => ({
    id: `${branchId}-seat-${roomNumber(FACILITY_ROOM_COUNTS.headSpa + index + 1)}`,
    branchId,
    name: `Giường Foot ${roomNumber(index + 1)}`,
    type: "FOOT_CHAIR" as const,
    suitableCategories: ["FOOT"] as FacilityServiceCategory[],
  }));
  const bodyRooms = Array.from({ length: FACILITY_ROOM_COUNTS.body }, (_, index) => ({
    id: `${branchId}-seat-${roomNumber(FACILITY_ROOM_COUNTS.headSpa + FACILITY_ROOM_COUNTS.foot + index + 1)}`,
    branchId,
    name: `Giường Body ${roomNumber(index + 1)}`,
    type: "MASSAGE_BED" as const,
    suitableCategories: ["BODY", "NECK_SHOULDER", "THERAPY", "COMBO"] as FacilityServiceCategory[],
  }));

  return [...headSpaRooms, ...footRooms, ...bodyRooms];
}

export function roomIdForServiceCategory(branchId: string, category: FacilityServiceCategory, offset = 0) {
  if (category === "HEAD_SPA") {
    return `${branchId}-seat-${roomNumber((offset % FACILITY_ROOM_COUNTS.headSpa) + 1)}`;
  }
  if (category === "FOOT") {
    return `${branchId}-seat-${roomNumber(FACILITY_ROOM_COUNTS.headSpa + (offset % FACILITY_ROOM_COUNTS.foot) + 1)}`;
  }
  return `${branchId}-seat-${roomNumber(FACILITY_ROOM_COUNTS.headSpa + FACILITY_ROOM_COUNTS.foot + (offset % FACILITY_ROOM_COUNTS.body) + 1)}`;
}
