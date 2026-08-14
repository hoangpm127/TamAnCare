import "server-only";

import { BOOKING_POLICY } from "@/lib/business-policy";

import { addMinutes } from "date-fns";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { allocateBookingResources, type AllocationUnit } from "@/lib/resource-allocation";
import { maybeAutoConfirmBookingGroup } from "@/lib/server/booking-automation";
import { legalDocumentEvidence } from "@/lib/server/legal-documents";
import { money, notifyCustomer, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { recordPackageLedger } from "@/lib/server/package-ledger";
import { buildPaymentCode } from "@/lib/server/payment-service";
import { minimumTipForBookings, minimumTipForDuration } from "@/lib/tip-policy";
import { calculatePaymentBreakdown } from "@/lib/payment-policy";
import { affiliateCustomerId, affiliateOwnerEligible, normalizeAffiliateCode } from "@/lib/referral-policy";
import { calculateVoucherDiscount, voucherRuleError } from "@/lib/server/voucher-rules";
import { phoneVerificationRequired } from "@/lib/server/otp-delivery";
import { claimInstalledReferral } from "@/lib/server/referral-installation";
import { bookingWindowError, intervalsOverlapWithBuffer, timeToMinutes } from "@/lib/scheduling-policy";
import { therapistWorksDuring } from "@/lib/server/therapist-schedule";
import { activeBedWhere, vietnamWorkDate } from "@/lib/server/facility-operations";
import { hasActiveWelcomeVoucher, WELCOME_VOUCHER_CODE } from "@/lib/welcome-voucher";

const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
const BUSINESS_OFFSET = "+07:00";
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;
const BOOKING_HOLD_MINUTES = 15;

export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingConflictError";
  }
}

export type AvailabilityInput = {
  serviceId?: string;
  units?: Array<{ serviceId: string; people: number }>;
  date: string;
  durationMinutes?: number;
  therapistId?: string;
  branchId?: string;
  includeUnavailable?: boolean;
};

export type BookingUnitInput = {
  bookingCode: string;
  serviceId: string;
  startTime: string;
  therapistId?: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  source?: string;
};

export type BookingGroupInput = {
  referenceCode: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  voucherCode?: string;
  campaignCode?: string;
  relationship?: "SELF" | "FRIEND" | "BOSS";
  careNote?: string;
  source?: string;
  bankCode?: string;
  customerPackageId?: string;
  guestSessionId?: string;
  authenticatedCustomerId?: string;
  installedReferralCampaignId?: string;
  actorUserId?: string;
  auditIpHash?: string;
  consent?: {
    subjectHash?: string;
    ipHash?: string;
    userAgentHash?: string;
  };
  units: BookingUnitInput[];
};

function parseBusinessDateTime(value: string) {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasZone ? value : `${value.slice(0, 19)}${BUSINESS_OFFSET}`);
}

function businessDayRange(date: string) {
  const start = new Date(`${date}T00:00:00${BUSINESS_OFFSET}`);
  return { start, end: addMinutes(start, 24 * 60) };
}

function businessParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function toBusinessIso(value: Date) {
  const parts = businessParts(value);
  return `${parts.date}T${parts.time}:00${BUSINESS_OFFSET}`;
}

function normalizePhone(value: string) {
  const cleaned = value.replace(/[^0-9+]/g, "");
  return cleaned || value.trim();
}

async function findAvailability(
  client: typeof db,
  input: AvailabilityInput,
) {
  const branch = await client.branch.findUnique({ where: { id: input.branchId ?? "cs1" } });
  const requestedLines = input.units?.length
    ? input.units
    : input.serviceId
      ? [{ serviceId: input.serviceId, people: 1 }]
      : [];
  const totalPeople = requestedLines.reduce((sum, line) => sum + line.people, 0);
  if (!branch || !requestedLines.length || totalPeople < 1 || totalPeople > BOOKING_POLICY.maximumGroupSize) return [];

  const serviceIds = [...new Set(requestedLines.map((line) => line.serviceId))];
  const services = await client.service.findMany({
    where: { id: { in: serviceIds }, isActive: true, isOnline: true },
  });
  if (services.length !== serviceIds.length) return [];
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const day = businessDayRange(input.date);
  const workDate = vietnamWorkDate(day.start);
  const categories = [...new Set(services.map((service) => service.category))];
  const [therapists, rooms, dayBookings] = await Promise.all([
    client.therapist.findMany({
      where: {
        branchId: branch.id,
        status: "ACTIVE",
        onlineBooking: true,
        services: { some: { id: { in: serviceIds } } },
      },
      select: {
        id: true,
        fullName: true,
        ratingAvg: true,
        services: { where: { id: { in: serviceIds } }, select: { id: true } },
        weeklySchedules: {
          where: { isActive: true },
          select: { weekday: true, startMinute: true, endMinute: true, isActive: true },
        },
        attendanceRecords: {
          where: { workDate },
          take: 1,
          select: { status: true, checkOutAt: true },
        },
      },
      orderBy: [{ servedCount: "asc" }, { ratingAvg: "desc" }, { fullName: "asc" }],
    }),
    client.room.findMany({
      where: { branchId: branch.id, AND: [activeBedWhere()], suitableCategories: { hasSome: categories } },
      select: { id: true, name: true, type: true, facilityRoomId: true, suitableCategories: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    client.booking.findMany({
      where: {
        branchId: branch.id,
        status: { in: [...BLOCKING_STATUSES] },
        startTime: { lt: day.end },
        endTime: { gt: day.start },
      },
      select: { startTime: true, endTime: true, therapistId: true, roomId: true },
    }),
  ]);

  const openMinute = timeToMinutes(branch.openTime);
  const lastBookingMinute = timeToMinutes(branch.lastBookingTime);
  const now = new Date();
  const slots = [];

  const therapistCanWork = (therapist: (typeof therapists)[number], serviceId: string, start: Date, end: Date) => {
    if (!therapist.services.some((service) => service.id === serviceId)) return false;
    if (!therapistWorksDuring(therapist.weeklySchedules, start, end)) return false;
    const attendance = therapist.attendanceRecords[0];
    if (attendance && ["ABSENT", "LEAVE", "OFF"].includes(attendance.status)) return false;
    if (attendance?.checkOutAt && start >= attendance.checkOutAt) return false;
    return true;
  };

  const buildUnits = (lines: Array<{ serviceId: string; people: number }>, start: Date) => {
    const result: AllocationUnit[] = [];
    lines.forEach((line, lineIndex) => {
      const service = serviceById.get(line.serviceId)!;
      const duration = requestedLines.length === 1 && input.durationMinutes
        ? input.durationMinutes
        : service.durationMin;
      for (let personIndex = 0; personIndex < line.people; personIndex += 1) {
        const end = addMinutes(start, duration);
        result.push({
          key: `${lineIndex}:${personIndex}:${line.serviceId}`,
          start,
          end,
          therapistCandidateIds: therapists
            .filter((therapist) => (!input.therapistId || totalPeople > 1 || therapist.id === input.therapistId)
              && therapistCanWork(therapist, line.serviceId, start, end))
            .map((therapist) => therapist.id),
          bedCandidateIds: rooms
            .filter((room) => room.suitableCategories.includes(service.category))
            .map((room) => room.id),
        });
      }
    });
    return result;
  };

  const allocate = (units: AllocationUnit[]) => allocateBookingResources({
    units,
    beds: rooms.map((room) => ({ id: room.id, facilityRoomId: room.facilityRoomId })),
    bookings: dayBookings,
    seatCapacity: Math.min(branch.seatCapacity, rooms.length),
    bufferMinutes: branch.bufferMinutes,
  });

  for (let minute = openMinute; minute <= lastBookingMinute; minute += BOOKING_POLICY.slotMinutes) {
    const start = addMinutes(day.start, minute);
    if (start < addMinutes(now, BOOKING_POLICY.minimumLeadMinutes)) continue;

    const invalidWindow = requestedLines.some((line) => {
      const service = serviceById.get(line.serviceId)!;
      const duration = requestedLines.length === 1 && input.durationMinutes ? input.durationMinutes : service.durationMin;
      return Boolean(bookingWindowError({
        startMinute: minute,
        durationMinutes: duration,
        openTime: branch.openTime,
        closeTime: branch.closeTime,
        lastBookingTime: branch.lastBookingTime,
      }));
    });
    if (invalidWindow) continue;

    const requestedUnits = buildUnits(requestedLines, start);
    const requestedAllocation = allocate(requestedUnits);
    const assignedTherapistIds = new Set(requestedAllocation?.assignments.map((item) => item.therapistId) ?? []);
    const assignedBedIds = new Set(requestedAllocation?.assignments.map((item) => item.bedId) ?? []);
    const singleUnit = requestedUnits.length === 1 ? requestedUnits[0] : null;
    const availableTherapistIds = singleUnit
      ? new Set(singleUnit.therapistCandidateIds.filter((id) => !dayBookings.some((booking) => booking.therapistId === id
        && intervalsOverlapWithBuffer(singleUnit.start, singleUnit.end, booking.startTime, booking.endTime, branch.bufferMinutes))))
      : assignedTherapistIds;
    const availableBedIds = singleUnit
      ? new Set(singleUnit.bedCandidateIds.filter((id) => !dayBookings.some((booking) => booking.roomId === id
        && intervalsOverlapWithBuffer(singleUnit.start, singleUnit.end, booking.startTime, booking.endTime, branch.bufferMinutes))))
      : assignedBedIds;
    const availableTherapists = therapists
      .filter((therapist) => availableTherapistIds.has(therapist.id))
      .map((therapist) => ({ id: therapist.id, fullName: therapist.fullName, ratingAvg: therapist.ratingAvg }));
    const availableRooms = rooms
      .filter((room) => availableBedIds.has(room.id))
      .map(({ id, name, type }) => ({ id, name, type }));

    let remainingCapacity = requestedAllocation ? totalPeople : 0;
    if (requestedLines.length === 1 && !input.therapistId) {
      const serviceId = requestedLines[0].serviceId;
      const maximum = Math.min(BOOKING_POLICY.maximumGroupSize, branch.seatCapacity, rooms.length, therapists.length);
      for (let people = maximum; people >= 1; people -= 1) {
        if (allocate(buildUnits([{ serviceId, people }], start))) {
          remainingCapacity = people;
          break;
        }
      }
    }
    const isAvailable = Boolean(requestedAllocation);
    const end = requestedUnits.reduce((latest, unit) => unit.end > latest ? unit.end : latest, requestedUnits[0].end);
    if (isAvailable || input.includeUnavailable) {
      slots.push({
        startTime: toBusinessIso(start),
        endTime: toBusinessIso(end),
        availableTherapists,
        availableRooms,
        remainingCapacity,
        isAvailable,
        allocationMode: requestedUnits.length === 1
          ? "SINGLE"
          : requestedAllocation?.sameRoom
            ? "SAME_ROOM"
            : requestedAllocation
              ? "SPLIT_ROOMS"
              : "UNAVAILABLE",
        roomCount: requestedAllocation?.roomCount ?? 0,
      });
    }
  }

  return slots;
}

export async function getAvailableSlotsFromDatabase(input: AvailabilityInput) {
  await expireUnpaidBookingHolds();
  return findAvailability(db, input);
}

export async function expireUnpaidBookingHolds() {
  const now = new Date();
  const expired = await db.bookingGroup.findMany({
    where: { status: "PENDING", paymentStatus: "UNPAID", holdExpiresAt: { lte: now } },
    select: { id: true, referenceCode: true, customerId: true, branchId: true },
    take: 500,
  });
  if (!expired.length) return 0;
  const groupIds = expired.map((item) => item.id);
  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.updateMany({
      where: { bookingGroupId: { in: groupIds }, status: "PENDING" },
      data: { status: "VOID", note: "Hết thời gian giữ chỗ trước khi đối soát." },
    });
    await tx.voucherUsage.updateMany({
      where: { booking: { groupId: { in: groupIds } }, status: "RESERVED" },
      data: { status: "CANCELLED" },
    });
    await tx.booking.updateMany({ where: { groupId: { in: groupIds }, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.bookingGroup.updateMany({ where: { id: { in: groupIds }, status: "PENDING" }, data: { status: "CANCELLED" } });
    for (const group of expired) {
      await notifyCustomer(tx, group.customerId, {
        branchId: group.branchId,
        type: "BOOKING",
        title: "Khung giờ giữ chỗ đã hết hạn",
        body: `${group.referenceCode} chưa nhận được khoản cọc trong ${BOOKING_HOLD_MINUTES} phút nên đã trả lại khung giờ. Bạn có thể chọn lịch mới ngay.`,
        actionUrl: "/booking",
      });
    }
  });
  return groupIds.length;
}

export async function createBookingGroup(input: BookingGroupInput) {
  await expireUnpaidBookingHolds();
  return db.$transaction(
    async (tx) => {
      const existing = await tx.bookingGroup.findUnique({
        where: { referenceCode: input.referenceCode },
        include: {
          branch: true,
          customer: true,
          payments: { orderBy: { createdAt: "desc" } },
          bookings: {
            include: { service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } },
            orderBy: { startTime: "asc" },
          },
        },
      });
      if (existing) {
        if (input.authenticatedCustomerId && existing.customerId !== input.authenticatedCustomerId) {
          throw new BookingConflictError("Mã yêu cầu đã được sử dụng.");
        }
        if (input.guestSessionId) {
          const existingGrant = await tx.bookingAccessGrant.findUnique({
            where: { guestSessionId_bookingGroupId: { guestSessionId: input.guestSessionId, bookingGroupId: existing.id } },
          });
          if (!existingGrant || existingGrant.expiresAt <= new Date()) throw new BookingConflictError("Mã yêu cầu đã được sử dụng.");
        }
        return existing;
      }

      const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
      if (!branch) throw new BookingConflictError("Cơ sở không tồn tại hoặc đang tạm ngưng nhận lịch.");
      if (input.units.length < 1 || input.units.length > BOOKING_POLICY.maximumGroupSize) {
        throw new BookingConflictError(`Số người trong một booking phải từ 1 đến ${BOOKING_POLICY.maximumGroupSize}.`);
      }

      const serviceIds = [...new Set(input.units.map((unit) => unit.serviceId))];
      const serviceRecords = await tx.service.findMany({ where: { id: { in: serviceIds }, isActive: true, isOnline: true } });
      if (serviceRecords.length !== serviceIds.length) throw new BookingConflictError("Có dịch vụ không còn nhận lịch online.");

      const customer = input.authenticatedCustomerId
        ? await tx.customer.findUnique({ where: { id: input.authenticatedCustomerId } })
        : await tx.customer.upsert({
            where: { phone: normalizePhone(input.customerPhone) },
            create: {
              fullName: input.customerName.trim() || "Khách Tâm An",
              phone: normalizePhone(input.customerPhone),
              firstSource: input.source ?? "WEB_APP",
              commonIssues: [],
            },
            update: { fullName: input.customerName.trim() || undefined },
          });
      if (!customer) throw new BookingConflictError("Không tìm thấy hồ sơ khách hàng đã đăng nhập.");

      const subtotalAmount = input.units.reduce((sum, unit) => {
        const service = serviceRecords.find((item) => item.id === unit.serviceId)!;
        return sum + service.basePrice + service.therapistFee;
      }, 0);

      const now = new Date();
      let activePackage: Prisma.CustomerPackageGetPayload<{ include: { packagePlan: true } }> | null = null;
      if (input.customerPackageId) {
        if (!input.authenticatedCustomerId) {
          throw new BookingConflictError("Bạn cần đăng nhập để sử dụng Gói dài hạn.");
        }
        if (input.voucherCode?.trim()) {
          throw new BookingConflictError("Gói dài hạn không dùng chung với voucher hoặc ưu đãi khác.");
        }
        activePackage = await tx.customerPackage.findFirst({
          where: {
            id: input.customerPackageId,
            customerId: customer.id,
            status: "ACTIVE",
            sessionsRemaining: { gte: input.units.length },
            expiresAt: { gte: now },
          },
          include: { packagePlan: true },
        });
        if (!activePackage) {
          throw new BookingConflictError("Gói dài hạn không còn đủ lượt hoặc đã hết hiệu lực.");
        }
        const packageServiceId = activePackage.serviceIdSnapshot ?? activePackage.packagePlan.serviceId;
        const packageShareable = activePackage.shareableSnapshot ?? activePackage.packagePlan.shareable;
        if (packageServiceId && serviceIds.some((serviceId) => serviceId !== packageServiceId)) {
          throw new BookingConflictError("Gói dài hạn không áp dụng cho dịch vụ đã chọn.");
        }
        if (input.units.length > 1 && !packageShareable) {
          throw new BookingConflictError("Gói này chỉ dùng cho một khách trong mỗi lần đặt lịch.");
        }
      }
      const requestedVoucherCode = input.voucherCode?.trim().toUpperCase();
      const requestedVoucherParts = requestedVoucherCode?.split("+").map((code) => code.trim()).filter(Boolean) ?? [];
      // Backward compatibility for installed PWAs that cached v1.8.11: the
      // checkout draft used the display label WELCOME150+AFF50 as if it were a
      // single voucher code. AFF50 is still granted only from the server-bound
      // referral below; this merely recovers the primary voucher.
      const normalizedVoucherCode = requestedVoucherParts.includes("WELCOME150")
        && requestedVoucherParts.every((code) => code === "WELCOME150" || code === "AFF50")
        ? "WELCOME150"
        : requestedVoucherCode;
      const voucher = normalizedVoucherCode
        ? await tx.voucher.findFirst({
            where: {
              code: normalizedVoucherCode,
              isActive: true,
              OR: [{ startsAt: null }, { startsAt: { lte: now } }],
              AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
            },
          })
        : null;
      const normalizedCampaignCode = normalizeAffiliateCode(input.campaignCode);
      const campaign = !activePackage && normalizedCampaignCode && input.installedReferralCampaignId
        ? await tx.campaign.findFirst({
            where: {
              id: input.installedReferralCampaignId,
              code: normalizedCampaignCode,
              source: { startsWith: "AFFILIATE:" },
            },
          })
        : null;
      if (!activePackage && input.campaignCode && !campaign) {
        throw new BookingConflictError("Hãy cài và mở Tâm An Center từ biểu tượng app trước khi dùng quyền lợi Affiliate.");
      }
      const affiliateOwnerCustomerId = affiliateCustomerId(campaign?.source);
      const affiliateOwner = affiliateOwnerCustomerId
        ? await tx.customerAccount.findUnique({ where: { customerId: affiliateOwnerCustomerId }, select: { phoneVerifiedAt: true } })
        : null;
      if (campaign && !affiliateOwnerEligible(affiliateOwner, phoneVerificationRequired())) {
        throw new BookingConflictError("Mã Affiliate chưa được kích hoạt hoặc đã tạm ngừng.");
      }
      if (affiliateOwnerCustomerId === customer.id) {
        throw new BookingConflictError("Bạn không thể dùng mã Affiliate của chính mình.");
      }
      if (campaign && !(await claimInstalledReferral(tx, {
        guestSessionId: input.guestSessionId,
        customerId: customer.id,
        campaignId: campaign.id,
      }))) {
        throw new BookingConflictError("Nguồn giới thiệu trên thiết bị không còn hợp lệ hoặc đã gắn với khách khác.");
      }
      if (normalizedVoucherCode === "AFF50") {
        throw new BookingConflictError("AFF50 được hệ thống tự cộng từ lời mời hợp lệ; bạn không cần nhập mã này.");
      }
      if (normalizedVoucherCode && !voucher) throw new BookingConflictError("Mã ưu đãi không còn hiệu lực.");
      if (voucher?.serviceId && serviceIds.some((serviceId) => serviceId !== voucher.serviceId)) {
        throw new BookingConflictError("Ưu đãi này không áp dụng cho dịch vụ đã chọn.");
      }
      const customerAccount = voucher && input.authenticatedCustomerId && (voucher.requiresVerifiedPhone || voucher.code === WELCOME_VOUCHER_CODE)
        ? await tx.customerAccount.findUnique({ where: { customerId: customer.id } })
        : null;
      const affiliateBonusVoucher = campaign && voucher?.code === WELCOME_VOUCHER_CODE && customerAccount
        ? await tx.voucher.findFirst({
            where: {
              code: "AFF50",
              isActive: true,
              OR: [{ startsAt: null }, { startsAt: { lte: now } }],
              AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
            },
          })
        : null;
      const voucherContext = {
        subtotal: subtotalAmount,
        serviceDurations: input.units.map((unit) => serviceRecords.find((item) => item.id === unit.serviceId)!.durationMin),
        bookingStartTime: input.units[0]?.startTime,
        authenticated: Boolean(input.authenticatedCustomerId),
        phoneVerified: Boolean(customerAccount?.phoneVerifiedAt),
        customer,
      };
      for (const appliedVoucher of [voucher, affiliateBonusVoucher]) {
        if (!appliedVoucher) continue;
        const ruleError = voucherRuleError(appliedVoucher, voucherContext);
        if (ruleError) throw new BookingConflictError(ruleError);
      }
      const activeUsageFilter = {
        OR: [
          { status: "CONFIRMED" },
          { status: "RESERVED", expiresAt: { gt: now } },
        ],
      } satisfies Prisma.VoucherUsageWhereInput;
      for (const appliedVoucher of [voucher, affiliateBonusVoucher]) {
        if (!appliedVoucher) continue;
        if (appliedVoucher.maxUsage) {
          const used = await tx.voucherUsage.count({ where: { voucherId: appliedVoucher.id, ...activeUsageFilter } });
          if (used >= appliedVoucher.maxUsage) throw new BookingConflictError(`Ưu đãi ${appliedVoucher.code} đã hết lượt sử dụng.`);
        }
        if (appliedVoucher.maxPerCustomer) {
          const used = await tx.voucherUsage.count({ where: { voucherId: appliedVoucher.id, customerId: customer.id, ...activeUsageFilter } });
          if (used >= appliedVoucher.maxPerCustomer) throw new BookingConflictError(`Khách hàng đã sử dụng hoặc đang giữ ưu đãi ${appliedVoucher.code}.`);
        }
      }
      if (
        voucher?.code === WELCOME_VOUCHER_CODE
        && (!input.authenticatedCustomerId || !hasActiveWelcomeVoucher(customerAccount, now))
      ) {
        throw new BookingConflictError("WELCOME150 đã hết hạn hoặc không còn khả dụng cho tài khoản này.");
      }

      const primaryVoucherDiscount = activePackage ? 0 : calculateVoucherDiscount(voucher, subtotalAmount);
      const affiliateBonusDiscount = activePackage
        ? 0
        : Math.min(
            Math.max(0, subtotalAmount - primaryVoucherDiscount),
            calculateVoucherDiscount(affiliateBonusVoucher, subtotalAmount),
          );
      const requestedDiscount = activePackage ? subtotalAmount : primaryVoucherDiscount + affiliateBonusDiscount;
      const paymentBreakdown = calculatePaymentBreakdown({
        originalAmount: subtotalAmount,
        discountAmount: requestedDiscount,
        depositPercent: BOOKING_POLICY.depositPercent,
        prepaid: Boolean(activePackage),
      });
      const { discountAmount, totalAmount, depositAmount } = paymentBreakdown;
      const holdExpiresAt = depositAmount > 0 ? addMinutes(now, BOOKING_HOLD_MINUTES) : null;

      const group = await tx.bookingGroup.create({
        data: {
          referenceCode: input.referenceCode,
          branchId: branch.id,
          customerId: customer.id,
          subtotalAmount,
          discountAmount,
          totalAmount,
          depositAmount,
          paidAmount: 0,
          voucherCode: [voucher?.code, affiliateBonusVoucher?.code].filter(Boolean).join("+") || null,
          relationship: input.relationship ?? "SELF",
          careNote: input.careNote,
          source: input.source,
          status: "PENDING",
          paymentStatus: depositAmount > 0 ? "UNPAID" : "PAID",
          holdExpiresAt,
        },
      });

      if (input.guestSessionId) {
        await tx.bookingAccessGrant.create({
          data: {
            guestSessionId: input.guestSessionId,
            bookingGroupId: group.id,
            expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          },
        });
      }

      if (input.consent) {
        const grantedAt = new Date();
        const documents = [
          legalDocumentEvidence("TERMS"),
          legalDocumentEvidence("PRIVACY"),
          legalDocumentEvidence("BOOKING_POLICY"),
        ];
        await tx.consentRecord.createMany({
          data: documents.map((document) => ({
            customerId: customer.id,
            guestSessionId: input.guestSessionId,
            bookingGroupId: group.id,
            ...document,
            source: "ONLINE_BOOKING" as const,
            granted: true,
            subjectHash: input.consent?.subjectHash,
            ipHash: input.consent?.ipHash,
            userAgentHash: input.consent?.userAgentHash,
            grantedAt,
          })),
        });
      }

      const preparedUnits = input.units.map((unit) => {
        const service = serviceRecords.find((item) => item.id === unit.serviceId)!;
        const start = parseBusinessDateTime(unit.startTime);
        const end = addMinutes(start, service.durationMin);
        const startMinute = businessParts(start).minuteOfDay;
        if (start < addMinutes(new Date(), BOOKING_POLICY.minimumLeadMinutes)) {
          throw new BookingConflictError(`Vui lòng đặt trước ít nhất ${BOOKING_POLICY.minimumLeadMinutes} phút.`);
        }
        const scheduleError = bookingWindowError({
          startMinute,
          durationMinutes: service.durationMin,
          openTime: branch.openTime,
          closeTime: branch.closeTime,
          lastBookingTime: branch.lastBookingTime,
        });
        if (scheduleError) throw new BookingConflictError(scheduleError);
        return { unit, service, start, end, workDate: vietnamWorkDate(start) };
      });
      const workDates = [...new Map(preparedUnits.map((item) => [item.workDate.toISOString(), item.workDate])).values()];
      const earliestStart = preparedUnits.reduce((value, item) => item.start < value ? item.start : value, preparedUnits[0].start);
      const latestEnd = preparedUnits.reduce((value, item) => item.end > value ? item.end : value, preparedUnits[0].end);
      const categories = [...new Set(serviceRecords.map((service) => service.category))];
      const [therapistCandidates, bedCandidates, resourceConflicts] = await Promise.all([
        tx.therapist.findMany({
          where: {
            branchId: branch.id,
            status: "ACTIVE",
            onlineBooking: true,
            services: { some: { id: { in: serviceIds } } },
          },
          orderBy: [{ servedCount: "asc" }, { ratingAvg: "desc" }, { fullName: "asc" }],
          include: {
            services: { where: { id: { in: serviceIds } }, select: { id: true } },
            weeklySchedules: {
              where: { isActive: true },
              select: { weekday: true, startMinute: true, endMinute: true, isActive: true },
            },
            attendanceRecords: {
              where: { workDate: { in: workDates } },
              select: { workDate: true, status: true, checkOutAt: true },
            },
          },
        }),
        tx.room.findMany({
          where: { branchId: branch.id, AND: [activeBedWhere()], suitableCategories: { hasSome: categories } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        tx.booking.findMany({
          where: {
            branchId: branch.id,
            status: { in: [...BLOCKING_STATUSES] },
            startTime: { lt: addMinutes(latestEnd, branch.bufferMinutes) },
            endTime: { gt: addMinutes(earliestStart, -branch.bufferMinutes) },
          },
          select: { therapistId: true, roomId: true, startTime: true, endTime: true },
        }),
      ]);

      const allocationUnits: AllocationUnit[] = preparedUnits.map(({ unit, service, start, end, workDate }) => ({
        key: unit.bookingCode,
        start,
        end,
        therapistCandidateIds: therapistCandidates.filter((therapist) => {
          if (unit.therapistId && therapist.id !== unit.therapistId) return false;
          if (!therapist.services.some((candidateService) => candidateService.id === service.id)) return false;
          if (!therapistWorksDuring(therapist.weeklySchedules, start, end)) return false;
          const attendance = therapist.attendanceRecords.find((item) => item.workDate.getTime() === workDate.getTime());
          if (attendance && ["ABSENT", "LEAVE", "OFF"].includes(attendance.status)) return false;
          if (attendance?.checkOutAt && start >= attendance.checkOutAt) return false;
          return true;
        }).map((therapist) => therapist.id),
        bedCandidateIds: bedCandidates
          .filter((bed) => bed.suitableCategories.includes(service.category))
          .map((bed) => bed.id),
      }));
      const resourceAllocation = allocateBookingResources({
        units: allocationUnits,
        beds: bedCandidates.map((bed) => ({ id: bed.id, facilityRoomId: bed.facilityRoomId })),
        bookings: resourceConflicts,
        seatCapacity: Math.min(branch.seatCapacity, bedCandidates.length),
        bufferMinutes: branch.bufferMinutes,
      });
      if (!resourceAllocation) {
        throw new BookingConflictError("Khung giờ vừa hết chỗ hoặc không còn đủ KTV và giường phù hợp cho cả nhóm. Vui lòng chọn giờ gần nhất.");
      }
      const assignmentByUnit = new Map(resourceAllocation.assignments.map((assignment) => [assignment.unitKey, assignment]));
      const bookingRecords = [];
      let allocatedDiscount = discountAmount;
      let allocatedDeposit = 0;

      for (const [index, unit] of input.units.entries()) {
        const service = serviceRecords.find((item) => item.id === unit.serviceId)!;
        const start = parseBusinessDateTime(unit.startTime);
        const end = addMinutes(start, service.durationMin);
        const assignment = assignmentByUnit.get(unit.bookingCode);
        if (!assignment) throw new BookingConflictError("Không thể hoàn tất phương án xếp KTV và giường cho lịch này.");

        const unitSubtotal = service.basePrice + service.therapistFee;
        const unitDiscount = activePackage ? unitSubtotal : Math.min(allocatedDiscount, unitSubtotal);
        allocatedDiscount -= unitDiscount;
        const unitTotal = unitSubtotal - unitDiscount;
        const unitDeposit = index === input.units.length - 1
          ? depositAmount - allocatedDeposit
          : activePackage
            ? 0
            : Math.min(
                Math.max(0, depositAmount - allocatedDeposit),
                Math.round(unitTotal * BOOKING_POLICY.depositPercent / 100),
              );
        allocatedDeposit += unitDeposit;

        const booking = await tx.booking.create({
          data: {
            bookingCode: unit.bookingCode,
            groupId: group.id,
            branchId: branch.id,
            customerId: customer.id,
            serviceId: service.id,
            therapistId: assignment.therapistId,
            roomId: assignment.bedId,
            voucherId: index === 0 ? voucher?.id : undefined,
            campaignId: affiliateBonusVoucher ? campaign?.id : undefined,
            customerPackageId: activePackage?.id,
            startTime: start,
            endTime: end,
            durationMin: service.durationMin,
            basePrice: service.basePrice,
            therapistFee: service.therapistFee,
            discountAmount: unitDiscount,
            totalAmount: unitTotal,
            depositAmount: unitDeposit,
            paidAmount: 0,
            source: unit.source ?? input.source,
            note: unit.note,
            status: "PENDING",
            paymentStatus: unitDeposit > 0 ? "UNPAID" : "PAID",
          },
        });
        bookingRecords.push(booking);
      }

      if (activePackage) {
        const packageReservation = await tx.customerPackage.updateMany({
          where: {
            id: activePackage.id,
            status: "ACTIVE",
            sessionsRemaining: { gte: bookingRecords.length },
            expiresAt: { gte: now },
          },
          data: {
            sessionsRemaining: { decrement: bookingRecords.length },
            sessionsReserved: { increment: bookingRecords.length },
          },
        });
        if (packageReservation.count !== 1) {
          throw new BookingConflictError("Gói dịch vụ vừa hết lượt khả dụng. Vui lòng kiểm tra lại.");
        }
        await recordPackageLedger(tx, {
          customerPackageId: activePackage.id,
          packagePlanId: activePackage.packagePlanId,
          customerId: activePackage.customerId,
          branchId: branch.id,
          bookingId: bookingRecords[0]?.id,
          bookingGroupId: group.id,
          event: "SESSION_RESERVED",
          availableDelta: -bookingRecords.length,
          reservedDelta: bookingRecords.length,
          description: `Giữ ${bookingRecords.length} lượt cho lịch ${group.referenceCode}`,
          metadata: { bookingIds: bookingRecords.map((item) => item.id) },
          idempotencyKey: `package:reserve:${activePackage.id}:${group.id}`,
        });
      }

      if (voucher && bookingRecords[0]) {
        const voucherConfirmedImmediately = depositAmount === 0;
        const appliedVoucherDiscounts = [
          { voucher, discountAmount: primaryVoucherDiscount },
          ...(affiliateBonusVoucher ? [{ voucher: affiliateBonusVoucher, discountAmount: affiliateBonusDiscount }] : []),
        ].filter((item) => item.discountAmount > 0);
        for (const applied of appliedVoucherDiscounts) {
          await tx.voucherUsage.create({
            data: {
              voucherId: applied.voucher.id,
              customerId: customer.id,
              bookingId: bookingRecords[0].id,
              discountAmount: applied.discountAmount,
              status: voucherConfirmedImmediately ? "CONFIRMED" : "RESERVED",
              expiresAt: voucherConfirmedImmediately ? null : holdExpiresAt,
              confirmedAt: voucherConfirmedImmediately ? now : null,
            },
          });
        }
        if (voucherConfirmedImmediately && voucher.code === WELCOME_VOUCHER_CODE && customerAccount) {
          await tx.customerAccount.update({
            where: { id: customerAccount.id },
            data: { creditBalance: Math.max(0, customerAccount.creditBalance - primaryVoucherDiscount) },
          });
          if (primaryVoucherDiscount > 0) {
            await tx.ledgerEntry.create({
              data: {
                branchId: branch.id,
                customerId: customer.id,
                bookingGroupId: group.id,
                bookingId: bookingRecords[0].id,
                category: "WELCOME_CREDIT",
                direction: "OUT",
                amount: primaryVoucherDiscount,
                description: `Quyền lợi thành viên mới WELCOME150 · ${group.referenceCode}`,
              },
            });
          }
        }
        if (voucherConfirmedImmediately && affiliateBonusDiscount > 0) {
          await tx.ledgerEntry.create({
            data: {
              branchId: branch.id,
              customerId: customer.id,
              bookingGroupId: group.id,
              bookingId: bookingRecords[0].id,
              category: "ADJUSTMENT",
              direction: "OUT",
              amount: affiliateBonusDiscount,
              description: `Voucher cài app Affiliate AFF50 · ${campaign?.code} · ${group.referenceCode}`,
            },
          });
        }
      }

      if (depositAmount > 0) {
        await tx.paymentTransaction.create({
          data: {
            bookingGroupId: group.id,
            branchId: branch.id,
            customerId: customer.id,
            type: "DEPOSIT",
            direction: "IN",
            status: "PENDING",
            amount: depositAmount,
            method: "BANK_TRANSFER_SEPAY",
            bankCode: input.bankCode,
            paymentCode: buildPaymentCode(group.referenceCode, "DEPOSIT"),
            idempotencyKey: `deposit:${group.referenceCode}`,
            note: "Cọc cho tài khoản nền tảng: 10% giá trị cuối cùng sau ưu đãi; chờ ngân hàng đối soát.",
          },
        });
      }

      const bookingAutomation = depositAmount === 0
        ? await maybeAutoConfirmBookingGroup(tx, group.id)
        : null;

      if (activePackage) {
        await notifyCustomer(tx, customer.id, {
          branchId: branch.id,
          type: "BOOKING",
          title: bookingAutomation?.confirmed
            ? "Chúc mừng! Lịch dùng gói đã được AI xác nhận"
            : `Đã giữ ${bookingRecords.length} lượt từ ${activePackage.planNameSnapshot ?? activePackage.packagePlan.name}`,
          body: bookingAutomation?.confirmed
            ? `${group.referenceCode} đã được xếp ${bookingAutomation.assignments.map((item) => `${item.therapistName} · ${item.roomName}`).join(", ")}. Khi đến, bạn chỉ cần đọc họ tên và số điện thoại để lễ tân tiếp nhận.`
            : `${group.referenceCode} không cần đặt cọc thêm; cơ sở đang xác nhận lịch và vị trí phục vụ.`,
          actionUrl: `/booking/success/${group.referenceCode}`,
        });
      } else if (depositAmount > 0) {
        await notifyCustomer(tx, customer.id, {
          branchId: branch.id,
          type: "PAYMENT",
          title: "Đã tạo yêu cầu cọc · Chờ đối soát",
          body: `${group.referenceCode} được giữ trong ${BOOKING_HOLD_MINUTES} phút; vui lòng chuyển đúng ${money(depositAmount)} và nội dung hiển thị trên VietQR.`,
          actionUrl: `/booking/success/${group.referenceCode}`,
        });
      } else {
        await notifyCustomer(tx, customer.id, {
          branchId: branch.id,
          type: "BOOKING",
          title: bookingAutomation?.confirmed ? "Chúc mừng! Lịch đã được AI xác nhận" : "Đã ghi nhận lịch không cần đặt cọc",
          body: bookingAutomation?.confirmed
            ? `${group.referenceCode} đã được xếp ${bookingAutomation.assignments.map((item) => `${item.therapistName} · ${item.roomName}`).join(", ")}. Khi đến, bạn chỉ cần đọc họ tên và số điện thoại để lễ tân tiếp nhận.`
            : `${group.referenceCode} đã áp dụng đủ ưu đãi; cơ sở đang xác nhận lịch.`,
          actionUrl: `/booking/success/${group.referenceCode}`,
        });
      }
      await notifyOperations(tx, {
        branchId: branch.id,
        type: "BOOKING",
        title: bookingAutomation?.confirmed ? `AI đã xác nhận & điều phối · ${customer.fullName}` : `Yêu cầu booking mới · ${customer.fullName}`,
        body: bookingAutomation?.confirmed
          ? `${group.referenceCode} · ${bookingRecords.length} khách · ${bookingAutomation.assignments.map((item) => `${item.therapistName} tại ${item.roomName}`).join(", ")}. Không cần duyệt lại.`
          : `${group.referenceCode} · ${bookingRecords.length} khách · ${activePackage ? `đã giữ lượt ${activePackage.planNameSnapshot ?? activePackage.packagePlan.name}` : depositAmount > 0 ? `chờ đối soát cọc ${money(depositAmount)}` : "không cần đặt cọc"}${group.relationship === "BOSS" ? " · Mời sếp, ưu tiên bố trí gần nhau" : group.relationship === "FRIEND" ? " · Mời bạn, ưu tiên bố trí gần nhau" : ""}.`,
        actionUrl: "/admin/bookings",
      });
      if (bookingAutomation?.confirmed) {
        for (const assignment of bookingAutomation.assignments) {
          await notifyTherapist(tx, {
            branchId: branch.id,
            therapistName: assignment.therapistName,
            type: "BOOKING",
            title: `IQ Care vừa điều phối lịch mới · ${customer.fullName}`,
            body: `${assignment.serviceName} · ${group.referenceCode} · ${assignment.roomName}. Lịch đã sẵn sàng trong Lịch của tôi.`,
            actionUrl: `/therapist/bookings/${assignment.bookingCode}`,
          });
        }
      }
      if (input.actorUserId) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: input.actorUserId,
            branchId: branch.id,
            action: "COUNTER_BOOKING_CREATE",
            entityType: "BookingGroup",
            entityId: group.id,
            after: {
              referenceCode: group.referenceCode,
              customerId: customer.id,
              bookingIds: bookingRecords.map((item) => item.id),
              totalAmount,
              depositAmount,
              paymentStatus: group.paymentStatus,
            },
            ipHash: input.auditIpHash,
          },
        });
      }

      return tx.bookingGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: {
          bookings: { include: { service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } } },
          payments: { orderBy: { createdAt: "desc" } },
          branch: true,
          customer: true,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function getBookingGroupByReference(referenceCode: string) {
  await expireUnpaidBookingHolds();
  return db.bookingGroup.findUnique({
    where: { referenceCode },
    include: {
      branch: true,
      customer: true,
      payments: { orderBy: { createdAt: "desc" } },
      bookings: {
        include: { service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } },
        orderBy: { startTime: "asc" },
      },
    },
  });
}

export function bookingGroupToDto(group: NonNullable<Awaited<ReturnType<typeof getBookingGroupByReference>>>) {
  const first = group.bookings[0];
  const depositPayment = group.payments.find((item) => item.type === "DEPOSIT");
  const checkoutPayment = group.payments.find((item) => item.type === "SERVICE_PAYMENT");
  return {
    id: group.id,
    referenceCode: group.referenceCode,
    bookingCode: group.referenceCode,
    branchId: group.branchId,
    branchLabel: group.branch.name.replace(/^Tâm An Center · /, ""),
    branchAddress: group.branch.address,
    customerName: group.customer.fullName,
    customerPhone: group.customer.phone,
    serviceLabel: group.bookings.map((item) => item.service.name).join(", "),
    therapistName: group.bookings.map((item) => item.therapist?.fullName).filter(Boolean).join(", ") || "Cơ sở sắp xếp",
    therapistIds: group.bookings.map((item) => item.therapistId).filter((id): id is string => Boolean(id)),
    roomName: group.bookings.map((item) => item.room?.name).filter(Boolean).join(", "),
    timeIso: first?.startTime.toISOString(),
    durationMin: Math.max(...group.bookings.map((item) => item.durationMin), 0),
    suggestedTipAmount: group.bookings.reduce((sum, item) => sum + item.service.suggestedTip, 0),
    minimumTipAmount: minimumTipForBookings(group.bookings),
    serviceId: first?.serviceId,
    rescheduleCount: Math.max(...group.bookings.map((item) => item.rescheduleCount), 0),
    subtotalAmount: group.subtotalAmount,
    discountAmount: group.discountAmount,
    voucherCode: group.voucherCode,
    totalAmount: group.totalAmount,
    depositAmount: group.depositAmount,
    tipAmount: group.bookings.reduce((sum, item) => sum + item.tipAmount, 0),
    dueAmount: Math.max(0, group.totalAmount - Math.min(group.paidAmount, group.totalAmount)),
    paidAmount: group.paidAmount,
    status: group.status,
    paymentStatus: group.paymentStatus,
    checkedInAt: first?.checkedInAt?.toISOString() ?? null,
    checkoutRequestedAt: first?.checkoutRequestedAt?.toISOString() ?? null,
    completedAt: first?.completedAt?.toISOString() ?? null,
    holdExpiresAt: group.holdExpiresAt?.toISOString() ?? null,
    usedPackage: Boolean(first?.customerPackageId),
    customerPackageId: first?.customerPackageId ?? null,
    packageName: first?.customerPackage?.planNameSnapshot ?? first?.customerPackage?.packagePlan.name ?? null,
    depositPayment: depositPayment ? {
      id: depositPayment.id,
      status: depositPayment.status,
      amount: depositPayment.amount,
      receivedAmount: depositPayment.receivedAmount,
      paymentCode: depositPayment.paymentCode,
      paidAt: depositPayment.paidAt?.toISOString(),
    } : null,
    checkoutPayment: checkoutPayment ? {
      id: checkoutPayment.id,
      status: checkoutPayment.status,
      amount: checkoutPayment.amount,
      receivedAmount: checkoutPayment.receivedAmount,
      paymentCode: checkoutPayment.paymentCode,
      paidAt: checkoutPayment.paidAt?.toISOString(),
    } : null,
    relationship: group.relationship,
    careNote: group.careNote,
    createdAt: group.createdAt.toISOString(),
    items: group.bookings.map((item) => ({
      bookingCode: item.bookingCode,
      serviceId: item.serviceId,
      name: item.service.name,
      qty: 1,
      amount: item.totalAmount,
      subtotalAmount: item.basePrice + item.therapistFee,
      startTime: item.startTime.toISOString(),
      durationMin: item.durationMin,
      rescheduleCount: item.rescheduleCount,
      therapistName: item.therapist?.fullName,
      roomName: item.room?.name,
    })),
  };
}

export function bookingToDto(booking: {
  id: string;
  bookingCode: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  startTime: Date;
  durationMin: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  tipAmount: number;
  discountAmount: number;
  rescheduleCount: number;
  status: string;
  paymentStatus: string;
  checkedInAt: Date | null;
  checkoutRequestedAt: Date | null;
  completedAt: Date | null;
  customerPackageId: string | null;
  note: string | null;
  createdAt: Date;
  branch: { name: string; address: string };
  customer: { fullName: string; phone: string };
  service: { name: string; suggestedTip: number };
  therapist: { fullName: string } | null;
  therapistId: string | null;
  room: { name: string } | null;
  customerPackage?: { planNameSnapshot?: string | null; packagePlan: { name: string } } | null;
}) {
  return {
    id: booking.id,
    referenceCode: booking.bookingCode,
    bookingCode: booking.bookingCode,
    branchId: booking.branchId,
    branchLabel: booking.branch.name.replace(/^Tâm An Center · /, ""),
    branchAddress: booking.branch.address,
    customerName: booking.customer.fullName,
    customerPhone: booking.customer.phone,
    serviceLabel: booking.service.name,
    therapistName: booking.therapist?.fullName ?? "Cơ sở sắp xếp",
    therapistIds: booking.therapistId ? [booking.therapistId] : [],
    roomName: booking.room?.name ?? "",
    timeIso: booking.startTime.toISOString(),
    durationMin: booking.durationMin,
    suggestedTipAmount: booking.service.suggestedTip,
    minimumTipAmount: minimumTipForDuration(booking.durationMin),
    serviceId: booking.serviceId,
    rescheduleCount: booking.rescheduleCount,
    subtotalAmount: booking.totalAmount + booking.discountAmount,
    discountAmount: booking.discountAmount,
    totalAmount: booking.totalAmount,
    depositAmount: booking.depositAmount,
    tipAmount: booking.tipAmount,
    dueAmount: Math.max(0, booking.totalAmount - Math.min(booking.paidAmount, booking.totalAmount)),
    paidAmount: booking.paidAmount,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    checkedInAt: booking.checkedInAt?.toISOString() ?? null,
    checkoutRequestedAt: booking.checkoutRequestedAt?.toISOString() ?? null,
    completedAt: booking.completedAt?.toISOString() ?? null,
    usedPackage: Boolean(booking.customerPackageId),
    customerPackageId: booking.customerPackageId,
    packageName: booking.customerPackage?.planNameSnapshot ?? booking.customerPackage?.packagePlan.name ?? null,
    relationship: "SELF",
    careNote: booking.note,
    createdAt: booking.createdAt.toISOString(),
    items: [{
      bookingCode: booking.bookingCode,
      serviceId: booking.serviceId,
      name: booking.service.name,
      qty: 1,
      amount: booking.totalAmount,
      startTime: booking.startTime.toISOString(),
      durationMin: booking.durationMin,
      rescheduleCount: booking.rescheduleCount,
      therapistName: booking.therapist?.fullName,
      roomName: booking.room?.name,
    }],
  };
}
