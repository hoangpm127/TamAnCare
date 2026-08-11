import { z } from "zod";
import { BED_TYPE_VALUES, FACILITY_STATUS_VALUES, SERVICE_CATEGORY_VALUES } from "@/lib/facility";

const nameSchema = z.string().trim().min(1).max(80);
const noteSchema = z.string().trim().max(500).optional().default("");
const statusSchema = z.enum(FACILITY_STATUS_VALUES).default("ACTIVE");
const sortOrderSchema = z.coerce.number().int().min(0).max(999).default(0);

export const floorMutationSchema = z.object({
  branchId: z.string().trim().min(1).max(100),
  name: nameSchema,
  status: statusSchema,
  sortOrder: sortOrderSchema,
  note: noteSchema,
});

export const facilityRoomMutationSchema = z.object({
  floorId: z.string().trim().min(1).max(100),
  name: nameSchema,
  status: statusSchema,
  sortOrder: sortOrderSchema,
  note: noteSchema,
});

export const bedMutationSchema = z.object({
  facilityRoomId: z.string().trim().min(1).max(100),
  name: nameSchema,
  type: z.enum(BED_TYPE_VALUES),
  status: statusSchema,
  suitableCategories: z.array(z.enum(SERVICE_CATEGORY_VALUES)).min(1).max(SERVICE_CATEGORY_VALUES.length),
  sortOrder: sortOrderSchema,
  note: noteSchema,
});

export const facilityStructureMutationSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("FLOOR"), id: z.string().trim().min(1).optional(), data: floorMutationSchema }),
  z.object({ entity: z.literal("ROOM"), id: z.string().trim().min(1).optional(), data: facilityRoomMutationSchema }),
  z.object({ entity: z.literal("BED"), id: z.string().trim().min(1).optional(), data: bedMutationSchema }),
]);

export const facilityStructureDeleteSchema = z.object({
  entity: z.enum(["FLOOR", "ROOM", "BED"]),
  id: z.string().trim().min(1).max(100),
});

export const facilityAssignmentSchema = z.object({
  bookingId: z.string().trim().min(1).max(100),
  bedId: z.string().trim().min(1).max(100),
  therapistId: z.string().trim().min(1).max(100),
});

export const attendanceMutationSchema = z.object({
  therapistId: z.string().trim().min(1).max(100),
  action: z.enum(["CHECK_IN", "CHECK_OUT", "MARK_ABSENT", "MARK_LEAVE", "MARK_OFF", "RESET"]),
  note: z.string().trim().max(500).optional().default(""),
});
