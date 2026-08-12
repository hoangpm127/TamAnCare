import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { DiscountType, PrismaClient } from "../app/generated/prisma/client";
import {
  bookings,
  branches,
  campaigns,
  customers,
  officeEvents,
  packagePlans,
  services,
  therapists,
  vouchers,
} from "../lib/demo-data";
import { hashPassword } from "../lib/password";
import { facilityRoomsForBranch, roomIdForServiceCategory } from "../lib/facility-config";
import { BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "../lib/business-distribution";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tam_an_care?schema=public",
});

const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 10_000,
    timeout: 60_000,
  },
});

const DESTRUCTIVE_SEED_CONFIRMATION = "DELETE_AND_REBUILD_DEMO_DATABASE";

function requiredSeedPassword(name: string) {
  const value = process.env[name];
  if (!value || value.length < 12) throw new Error(`${name} phải được cấu hình và có ít nhất 12 ký tự.`);
  return value;
}

function validateSeedPasswords() {
  [
    "SEED_OWNER_PASSWORD",
    "SEED_MANAGER_CS1_PASSWORD",
    "SEED_MANAGER_CS2_PASSWORD",
    "SEED_RECEPTION_CS1_PASSWORD",
    "SEED_RECEPTION_CS2_PASSWORD",
    "SEED_INVESTOR_PASSWORD",
    "SEED_CUSTOMER_PASSWORD",
  ].forEach(requiredSeedPassword);
}

const branchConfig = [
  {
    id: "cs1",
    name: "Tâm An Center · Cơ sở 1",
    address: branches.find((item) => item.id === "cs1")?.address ?? "Cơ sở 1",
    phone: branches.find((item) => item.id === "cs1")?.phone,
    seatCapacity: branches.find((item) => item.id === "cs1")?.seatCapacity ?? 18,
  },
  {
    id: "cs2",
    name: "Tâm An Center · Cơ sở 2",
    address: branches.find((item) => item.id === "cs2")?.address ?? "Cơ sở 2",
    phone: branches.find((item) => item.id === "cs2")?.phone,
    seatCapacity: branches.find((item) => item.id === "cs2")?.seatCapacity ?? 18,
  },
];

const monthlyRevenuePattern = [0.88, 1.08, 0.95, 1.14, 1.02, 0.91, 1.11, 0.97, 1.16, 0.93, 1.05, 1];
const monthlyExpensePattern = [1.12, 0.84, 1.06, 0.91, 1.18, 0.88, 1.03, 0.95, 1.15, 0.86, 1.08, 0.94];
const dailyRevenuePattern = [0.91, 1.08, 0.96, 1.15, 0.88, 1.04, 1.12];

function demoMonthlyFinance(month: number, branchIndex: number) {
  const revenueBase = branchIndex === 0 ? 257_000_000 : 263_000_000;
  const expenseBase = branchIndex === 0 ? 145_000_000 : 151_000_000;
  const revenueFactor = monthlyRevenuePattern[(month + branchIndex * 2) % monthlyRevenuePattern.length];
  const expenseFactor = monthlyExpensePattern[(month + branchIndex * 3) % monthlyExpensePattern.length];
  return {
    revenue: Math.round(revenueBase * revenueFactor / 100_000) * 100_000,
    expenses: Math.round(expenseBase * expenseFactor / 100_000) * 100_000,
  };
}

async function clearDatabase() {
  await prisma.$transaction([
    prisma.rateLimitCounter.deleteMany(),
    prisma.consentRecord.deleteMany(),
    prisma.bookingAccessGrant.deleteMany(),
    prisma.paymentAccessGrant.deleteMany(),
    prisma.businessAccessGrant.deleteMany(),
    prisma.businessAllocation.deleteMany(),
    prisma.businessAttribution.deleteMany(),
    prisma.businessLead.deleteMany(),
    prisma.businessMediaAsset.deleteMany(),
    prisma.businessAffiliate.deleteMany(),
    prisma.businessDistrict.deleteMany(),
    prisma.guestSession.deleteMany(),
    prisma.adminAuditLog.deleteMany(),
    prisma.mfaRecoveryCode.deleteMany(),
    prisma.paymentWebhookEvent.deleteMany(),
    prisma.investorDistribution.deleteMany(),
    prisma.investorAllocation.deleteMany(),
    prisma.investorProfile.deleteMany(),
    prisma.investmentOpportunityCheck.deleteMany(),
    prisma.investmentOpportunity.deleteMany(),
    prisma.investorBenefit.deleteMany(),
    prisma.refundRequest.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.tipPayout.deleteMany(),
    prisma.paymentTransaction.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.expenseEvidence.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.customerMonthlyPolicy.deleteMany(),
    prisma.adminSession.deleteMany(),
    prisma.customerSession.deleteMany(),
    prisma.passwordResetChallenge.deleteMany(),
    prisma.customerAccount.deleteMany(),
    prisma.voucherUsage.deleteMany(),
    prisma.review.deleteMany(),
    prisma.reminder.deleteMany(),
    prisma.officeRegistration.deleteMany(),
    prisma.officeEvent.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.bookingGroup.deleteMany(),
    prisma.customerPackage.deleteMany(),
    prisma.packagePlan.deleteMany(),
    prisma.voucher.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.therapistAttendance.deleteMany(),
    prisma.room.deleteMany(),
    prisma.facilityRoom.deleteMany(),
    prisma.facilityFloor.deleteMany(),
    prisma.therapist.deleteMany(),
    prisma.service.deleteMany(),
    prisma.user.deleteMany(),
    prisma.branch.deleteMany(),
  ]);
}

async function seedBranchesAndStaff() {
  for (const item of branchConfig) {
    await prisma.branch.create({
      data: {
        ...item,
        openTime: "09:00",
        closeTime: "24:00",
        lastBookingTime: "23:00",
        bufferMinutes: 15,
      },
    });
  }

  const owner = await prisma.user.create({
    data: {
      name: "Admin Tâm An",
      username: "admin.taman",
      email: "owner@tamancare.local",
      passwordHash: hashPassword(requiredSeedPassword("SEED_OWNER_PASSWORD")),
      passwordChangedAt: new Date(),
      role: "OWNER",
    },
  });

  const xgroup = await prisma.user.create({
    data: {
      name: "Xgroup Super Admin",
      username: "xgroup.superadmin",
      email: "superadmin@xgroup.local",
      passwordHash: hashPassword(requiredSeedPassword("SEED_OWNER_PASSWORD")),
      passwordChangedAt: new Date(),
      role: "XGROUP_SUPER_ADMIN",
    },
  });

  const districtManagerCauGiay = await prisma.user.create({
    data: {
      name: "Trưởng phòng KD Quận Cầu Giấy",
      username: "truongphong.caugiay",
      email: "sales.caugiay@xgroup.local",
      passwordHash: hashPassword(requiredSeedPassword("SEED_MANAGER_CS1_PASSWORD")),
      passwordChangedAt: new Date(),
      role: "DISTRICT_SALES_MANAGER",
    },
  });

  const districtManagerHaDong = await prisma.user.create({
    data: {
      name: "Trưởng phòng KD Quận Hà Đông",
      username: "truongphong.hadong",
      email: "sales.hadong@xgroup.local",
      passwordHash: hashPassword(requiredSeedPassword("SEED_MANAGER_CS2_PASSWORD")),
      passwordChangedAt: new Date(),
      role: "DISTRICT_SALES_MANAGER",
    },
  });

  await prisma.user.createMany({
    data: [
      {
        name: "Quản lý Cơ sở 1",
        username: "quanly.cs1",
        email: "manager.cs1@tamancare.local",
        passwordHash: hashPassword(requiredSeedPassword("SEED_MANAGER_CS1_PASSWORD")),
        passwordChangedAt: new Date(),
        role: "MANAGER",
        branchId: "cs1",
      },
      {
        name: "Quản lý Cơ sở 2",
        username: "quanly.cs2",
        email: "manager.cs2@tamancare.local",
        passwordHash: hashPassword(requiredSeedPassword("SEED_MANAGER_CS2_PASSWORD")),
        passwordChangedAt: new Date(),
        role: "MANAGER",
        branchId: "cs2",
      },
      {
        name: "Lễ tân Cơ sở 1",
        username: "reception.cs1",
        email: "reception.cs1@tamancare.local",
        passwordHash: hashPassword(requiredSeedPassword("SEED_RECEPTION_CS1_PASSWORD")),
        passwordChangedAt: new Date(),
        role: "RECEPTIONIST",
        branchId: "cs1",
      },
      {
        name: "Lễ tân Cơ sở 2",
        username: "reception.cs2",
        email: "reception.cs2@tamancare.local",
        passwordHash: hashPassword(requiredSeedPassword("SEED_RECEPTION_CS2_PASSWORD")),
        passwordChangedAt: new Date(),
        role: "RECEPTIONIST",
        branchId: "cs2",
      },
    ],
  });

  const investor = await prisma.user.create({
    data: {
      name: "Nhà đầu tư Tâm An",
      username: "nhadautu.demo",
      email: "investor@tamancare.local",
      passwordHash: hashPassword(requiredSeedPassword("SEED_INVESTOR_PASSWORD")),
      passwordChangedAt: new Date(),
      role: "INVESTOR",
    },
  });

  return { owner, investor, xgroup, districtManagerCauGiay, districtManagerHaDong };
}

async function seedXgroup(ownerId: string, xgroupId: string, districtManagerCauGiayId: string, districtManagerHaDongId: string) {
  const [cauGiay, haDong] = await Promise.all([
    prisma.businessDistrict.create({ data: { code: "CAU_GIAY", name: "Quận Cầu Giấy", city: "Hà Nội", managerUserId: districtManagerCauGiayId, annualGmvTarget: BigInt(26_100_000_000) } }),
    prisma.businessDistrict.create({ data: { code: "HA_DONG", name: "Quận Hà Đông", city: "Hà Nội", managerUserId: districtManagerHaDongId, annualGmvTarget: BigInt(26_100_000_000) } }),
  ]);
  const affiliateSeeds = [
    { code: "CEO-CG-001", districtId: cauGiay.id, displayName: "Nguyễn Minh Anh", organization: "TechVision Việt Nam", title: "Giám đốc điều hành", referrerProfile: "CEO giới thiệu trực tiếp", conflictDisclosureRequired: true, conflictDisclosureAcceptedAt: new Date(), complianceNote: "Doanh nghiệp đã tiếp nhận thông tin công bố lợi ích giới thiệu." },
    { code: "MUAHANG-CG-02", districtId: cauGiay.id, displayName: "Lê Thu Hà", organization: "CMC Tower", title: "Phòng Mua hàng", referrerProfile: "Đầu mối mua hàng doanh nghiệp", conflictDisclosureRequired: true, conflictDisclosureAcceptedAt: null, complianceNote: "Chờ văn bản chấp thuận nội bộ trước khi kích hoạt chi trả." },
    { code: "CEO-HD-001", districtId: haDong.id, displayName: "Trần Quốc Huy", organization: "Lotus Finance", title: "Tổng Giám đốc", referrerProfile: "CEO giới thiệu trực tiếp", conflictDisclosureRequired: true, conflictDisclosureAcceptedAt: new Date(), complianceNote: "Đã lưu chấp thuận công bố lợi ích." },
    { code: "TOWER-HD-02", districtId: haDong.id, displayName: "Phạm Lan Chi", organization: "Hồ Gươm Plaza", title: "Quản lý tòa nhà", referrerProfile: "Đầu mối tòa văn phòng", conflictDisclosureRequired: false, conflictDisclosureAcceptedAt: null, complianceNote: "Nguồn giới thiệu độc lập, không tham gia quyết định mua." },
  ];
  const affiliates = [];
  for (const item of affiliateSeeds) {
    affiliates.push(await prisma.businessAffiliate.create({ data: { ...item, status: item.conflictDisclosureRequired && !item.conflictDisclosureAcceptedAt ? "PENDING_DUE_DILIGENCE" : "ACTIVE", commissionRateBps: 1000, phone: "0909000000", email: `${item.code.toLowerCase()}@example.local`, createdByUserId: xgroupId } }));
  }
  const assetSeeds = [
    { code: "QR-CG-CEO01", districtId: cauGiay.id, affiliateId: affiliates[0].id, type: "QR" as const, title: "QR Business · CEO Cầu Giấy", destinationPath: "/doanh-nghiep", status: "ACTIVE" as const, clickCount: 184, leadCount: 14 },
    { code: "LINK-CG-MH02", districtId: cauGiay.id, affiliateId: affiliates[1].id, type: "LINK" as const, title: "Báo giá sức khỏe định kỳ · CMC", destinationPath: "/doanh-nghiep", status: "PAUSED" as const, clickCount: 92, leadCount: 7 },
    { code: "VIDEO-CG-01", districtId: cauGiay.id, affiliateId: affiliates[0].id, type: "VIDEO" as const, title: "Video quy trình triển khai tại văn phòng", destinationPath: "/doanh-nghiep", videoUrl: "https://www.youtube.com/", status: "ACTIVE" as const, clickCount: 261, leadCount: 19 },
    { code: "QR-HD-CEO01", districtId: haDong.id, affiliateId: affiliates[2].id, type: "QR" as const, title: "QR Business · CEO Hà Đông", destinationPath: "/doanh-nghiep", status: "ACTIVE" as const, clickCount: 147, leadCount: 12 },
    { code: "LINK-HD-TOWER", districtId: haDong.id, affiliateId: affiliates[3].id, type: "LINK" as const, title: "Link đối tác tòa nhà Hà Đông", destinationPath: "/doanh-nghiep", status: "ACTIVE" as const, clickCount: 116, leadCount: 9 },
    { code: "QR-XGROUP-HD", districtId: haDong.id, affiliateId: null, type: "QR" as const, title: "QR chiến dịch Xgroup Hà Đông", destinationPath: "/doanh-nghiep", status: "ACTIVE" as const, clickCount: 204, leadCount: 16 },
  ];
  const assets = [];
  for (const item of assetSeeds) assets.push(await prisma.businessMediaAsset.create({ data: { ...item, createdByUserId: xgroupId } }));

  const customer = await prisma.customer.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const year = new Date().getFullYear();
  const completedSeeds = [
    { companyName: "TechVision Việt Nam", district: cauGiay, affiliate: affiliates[0], asset: assets[0], branchId: "cs1", total: 85_000_000, month: 1, day: 18 },
    { companyName: "CMC Digital Workplace", district: cauGiay, affiliate: affiliates[0], asset: assets[2], branchId: "cs1", total: 122_000_000, month: 2, day: 21 },
    { companyName: "Lotus Finance", district: haDong, affiliate: affiliates[2], asset: assets[3], branchId: "cs2", total: 96_000_000, month: 3, day: 16 },
    { companyName: "Hồ Gươm Office", district: haDong, affiliate: affiliates[3], asset: assets[4], branchId: "cs2", total: 143_000_000, month: 4, day: 23 },
    { companyName: "Future Cloud Hà Nội", district: cauGiay, affiliate: affiliates[0], asset: assets[0], branchId: "cs1", total: 111_000_000, month: 5, day: 20 },
    { companyName: "An Phát Holdings", district: haDong, affiliate: affiliates[3], asset: assets[5], branchId: "cs2", total: 164_000_000, month: 6, day: 19 },
  ];
  for (const [index, item] of completedSeeds.entries()) {
    const therapist = await prisma.therapist.findFirstOrThrow({ where: { branchId: item.branchId }, orderBy: { ratingAvg: "desc" } });
    const startsAt = new Date(`${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}T11:30:00+07:00`);
    const completedAt = new Date(startsAt.getTime() + 2 * 60 * 60_000);
    const deposit = Math.round(item.total * 0.1);
    const event = await prisma.officeEvent.create({ data: { branchId: item.branchId, customerId: customer.id, leadTherapistId: therapist.id, eventCode: `XGB-${year}-${String(index + 1).padStart(3, "0")}`, companyName: item.companyName, contactName: customer.fullName, contactPhone: customer.phone, location: `${item.district.name}, Hà Nội`, serviceLabel: "Chăm sóc sức khỏe định kỳ tại doanh nghiệp", packageTier: "Tâm An Business", headcount: 80 + index * 12, durationMin: 20, requiredTherapists: 6 + index, sessionsTotal: 8, sessionsUsed: 1, startsAt, endsAt: completedAt, actualStartedAt: startsAt, expectedEndAt: completedAt, actualEndedAt: completedAt, completedAt, subtotalAmount: item.total, totalAmount: item.total, depositAmount: deposit, paidAmount: item.total, paymentStatus: "PAID", status: "COMPLETED", customerRating: 4 + (index % 2), reviewedAt: completedAt } });
    const depositPayment = await prisma.paymentTransaction.create({ data: { officeEventId: event.id, branchId: item.branchId, customerId: customer.id, type: "DEPOSIT", direction: "IN", status: "CONFIRMED", amount: deposit, receivedAmount: deposit, method: "BANK_TRANSFER_SEPAY", bankCode: "TPBANK", paymentCode: `XGDEP${year}${String(index + 1).padStart(3, "0")}`, externalReference: `XGROUP-DEPOSIT-${year}-${index + 1}`, idempotencyKey: `business-deposit:${event.eventCode}`, paidAt: new Date(startsAt.getTime() - 7 * 86_400_000) } });
    const balancePayment = await prisma.paymentTransaction.create({ data: { officeEventId: event.id, branchId: item.branchId, customerId: customer.id, type: "SERVICE_PAYMENT", direction: "IN", status: "CONFIRMED", amount: item.total - deposit, receivedAmount: item.total - deposit, method: "COUNTER_BANK_TRANSFER", bankCode: "TPBANK", paymentCode: `XGBAL${year}${String(index + 1).padStart(3, "0")}`, externalReference: `XGROUP-BALANCE-${year}-${index + 1}`, idempotencyKey: `business-balance:${event.eventCode}`, paidAt: completedAt } });
    await prisma.ledgerEntry.createMany({ data: [{ branchId: item.branchId, customerId: customer.id, officeEventId: event.id, paymentTransactionId: depositPayment.id, category: "CUSTOMER_DEPOSIT", dataOrigin: "DEMO", direction: "IN", amount: deposit, description: `Cọc Business · ${item.companyName}`, occurredAt: depositPayment.paidAt! }, { branchId: item.branchId, customerId: customer.id, officeEventId: event.id, paymentTransactionId: balancePayment.id, category: "SERVICE_REVENUE", dataOrigin: "DEMO", direction: "IN", amount: item.total, description: `Doanh thu Business · ${item.companyName}`, occurredAt: completedAt }] });
    await prisma.tipPayout.create({ data: { officeEventId: event.id, therapistId: therapist.id, branchId: item.branchId, amount: 1_200_000 + index * 150_000, serviceDate: completedAt, dueAt: completedAt, status: "PAID", paidAt: completedAt } });
    await prisma.businessLead.create({ data: { leadCode: `LEAD-${event.eventCode}`, districtId: item.district.id, affiliateId: item.affiliate.id, sourceAssetId: item.asset.id, officeEventId: event.id, ownerUserId: item.district.managerUserId, companyName: item.companyName, contactName: customer.fullName, contactPhone: customer.phone, officeAddress: event.location, estimatedGmv: item.total, stage: "WON", nextAction: "Chăm sóc tái ký chu kỳ tiếp theo", createdAt: new Date(startsAt.getTime() - 30 * 86_400_000) } });
    const attribution = await prisma.businessAttribution.create({ data: { officeEventId: event.id, districtId: item.district.id, affiliateId: item.affiliate.id, sourceAssetId: item.asset.id, sourceLabel: `${item.asset.type} · ${item.asset.title}`, grossAmount: item.total, tipExcludedAmount: 1_200_000 + index * 150_000 } });
    const split = calculateBusinessDistribution(item.total);
    for (const recipient of Object.keys(BUSINESS_DISTRIBUTION_RATES) as Array<keyof typeof BUSINESS_DISTRIBUTION_RATES>) {
      const paid = index < 3;
      await prisma.businessAllocation.create({ data: { attributionId: attribution.id, recipient, rateBps: BUSINESS_DISTRIBUTION_RATES[recipient], amount: split[recipient], beneficiaryLabel: recipient === "KTV_DIRECT" ? "Đội KTV trực tiếp triển khai" : recipient === "TEAM_LEADER" ? therapist.fullName : recipient === "XGROUP_PLATFORM" ? "Nền tảng Xgroup" : recipient === "DISTRICT_DIRECTOR" ? (item.district.managerUserId === districtManagerCauGiayId ? "Trưởng phòng KD Quận Cầu Giấy" : "Trưởng phòng KD Quận Hà Đông") : item.affiliate.displayName, beneficiaryReference: recipient === "XGROUP_PLATFORM" ? "XGROUP" : recipient === "DISTRICT_DIRECTOR" ? item.district.managerUserId : recipient === "DIRECT_AFFILIATE" ? item.affiliate.id : therapist.id, status: paid ? "PAID" : index < 5 ? "APPROVED" : "READY", dueAt: new Date(completedAt.getTime() + 7 * 86_400_000), approvedAt: paid || index < 5 ? completedAt : null, approvedByUserId: paid || index < 5 ? xgroupId : null, paidAt: paid ? new Date(completedAt.getTime() + 3 * 86_400_000) : null, bankReference: paid ? `XGROUP-PAYOUT-${year}-${index + 1}-${recipient}` : null } });
    }
  }
  await prisma.notification.createMany({ data: [{ userId: xgroupId, type: "FINANCE", title: "Control Tower Xgroup đã sẵn sàng", body: "Báo cáo Business 65%/35%, địa bàn, Affiliate và đối soát đã được nối vào dữ liệu vận hành.", actionUrl: "/xgroup" }, { userId: districtManagerCauGiayId, type: "BOOKING", title: "Địa bàn Cầu Giấy đã được cấp", body: "Bạn có thể quản lý phễu Business, Affiliate và tài sản nguồn trong phạm vi Quận Cầu Giấy.", actionUrl: "/xgroup/districts" }, { userId: districtManagerHaDongId, type: "BOOKING", title: "Địa bàn Hà Đông đã được cấp", body: "Bạn có thể quản lý phễu Business, Affiliate và tài sản nguồn trong phạm vi Quận Hà Đông.", actionUrl: "/xgroup/districts" }, { userId: ownerId, type: "SYSTEM", title: "Đã tách quyền Xgroup Business", body: "Admin Tâm An tiếp tục vận hành cơ sở; báo cáo phân phối Business toàn cục thuộc Xgroup Super Admin.", actionUrl: "/admin" }] });
}

async function seedCatalog() {
  for (const [sortOrder, service] of services.entries()) {
    await prisma.service.create({
      data: {
        id: service.id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        durationMin: service.durationMin,
        basePrice: service.basePrice,
        therapistFee: service.therapistFee,
        sortOrder,
      },
    });
  }

  for (const branchItem of branchConfig) {
    const floor = await prisma.facilityFloor.create({
      data: {
        id: `${branchItem.id}-floor-1`,
        branchId: branchItem.id,
        name: "Tầng 1",
        status: "ACTIVE",
        sortOrder: 0,
      },
    });
    const facilityRoom = await prisma.facilityRoom.create({
      data: {
        id: `${branchItem.id}-room-main`,
        floorId: floor.id,
        name: "Khu hiện có",
        status: "ACTIVE",
        sortOrder: 0,
        note: "Hãy đổi tên và sắp xếp theo mặt bằng thực tế của cơ sở.",
      },
    });
    const namedTherapists = therapists.filter((item) => item.branchId === branchItem.id).slice(0, 8);
    for (let index = 0; index < 8; index += 1) {
      const demo = namedTherapists[index];
      const therapistId = demo?.id ?? `${branchItem.id}-ktv-${String(index + 1).padStart(2, "0")}`;
      await prisma.therapist.create({
        data: {
          id: therapistId,
          branchId: branchItem.id,
          fullName: demo?.fullName ?? `KTV ${branchItem.id.toUpperCase()} ${String(index + 1).padStart(2, "0")}`,
          skills: demo?.skills ?? ["Foot", "Body", "Chăm sóc thư giãn"],
          publicBio: "KTV được đào tạo theo tiêu chuẩn Tâm An Center, chú trọng sự chỉn chu, an toàn và trải nghiệm riêng của từng khách.",
          publicStrengths: demo?.skills ?? ["Foot", "Body", "Chăm sóc thư giãn"],
          profileApprovalStatus: "APPROVED",
          shiftLabel: "09:00-24:00",
          status: "ACTIVE",
          onlineBooking: true,
          ratingAvg: demo?.ratingAvg ?? 4.8,
          servedCount: demo?.servedCount ?? 120 + index * 11,
          repeatCount: demo?.repeatCount ?? 35 + index * 4,
          services: {
            connect: services.map((service) => ({ id: service.id })),
          },
        },
      });
    }

    for (const [sortOrder, room] of facilityRoomsForBranch(branchItem.id).entries()) {
      await prisma.room.create({
        data: {
          id: room.id,
          branchId: branchItem.id,
          facilityRoomId: facilityRoom.id,
          name: room.name,
          type: room.type,
          status: "ACTIVE",
          suitableCategories: room.suitableCategories,
          sortOrder,
        },
      });
    }
  }

  for (const campaign of campaigns) {
    await prisma.campaign.create({
      data: { name: campaign.name, code: campaign.code, source: campaign.source, manualCost: campaign.cost },
    });
  }
  await prisma.campaign.create({
    data: { name: "Affiliate · Minh Anh", code: "MINHANH4567", source: "AFFILIATE:cus-1", manualCost: 50000 },
  });

  for (const voucher of vouchers) {
    const campaign = campaigns.find((item) => voucher.code.includes("OFFICE") && item.code === "OFFICE-CMC");
    const campaignRecord = campaign ? await prisma.campaign.findUnique({ where: { code: campaign.code } }) : null;
    await prisma.voucher.create({
      data: {
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        discountType: voucher.type as DiscountType,
        discountValue: voucher.value,
        minimumSpend: voucher.minSpend,
        maximumDiscount: ["RETURN7", "AFF50"].includes(voucher.code) ? 50_000 : null,
        displayConstraint: voucher.constraint,
        accentColor: voucher.accent,
        firstVisitOnly: ["FIRST60", "WELCOME150", "AFF50"].includes(voucher.code),
        requiresAccount: ["WELCOME100", "WELCOME150", "AFF50"].includes(voucher.code),
        requiresVerifiedPhone: ["WELCOME100", "FIRST60"].includes(voucher.code),
        minimumServiceDurationMin: voucher.code === "FIRST60" ? 60 : null,
        bookingStartMinuteMin: voucher.code === "DUYTAN50" ? 11 * 60 : null,
        bookingStartMinuteMax: voucher.code === "SANG70" ? 12 * 60 : voucher.code === "DUYTAN50" ? 14 * 60 : null,
        excludeWeekend: voucher.code === "RETURN7",
        validWithinDaysAfterLastVisit: voucher.code === "RETURN7" ? 7 : null,
        maxUsage: 100,
        maxPerCustomer: 1,
        campaignId: campaignRecord?.id,
        isActive: voucher.active,
      },
    });
  }

  await prisma.voucher.upsert({
    where: { code: "WELCOME100" },
    create: {
      code: "WELCOME100",
      name: "Ưu đãi thành viên mới 100K",
      description: "Tặng 100.000đ cho khách tạo tài khoản lần đầu.",
      discountType: "FIXED",
      discountValue: 100000,
      minimumSpend: 200000,
      displayConstraint: "Một lần cho mỗi tài khoản mới",
      accentColor: "#8f241d",
      requiresAccount: true,
      requiresVerifiedPhone: true,
      maxPerCustomer: 1,
      isActive: true,
    },
    update: {},
  });

  for (const plan of packagePlans) {
    await prisma.packagePlan.create({
      data: {
        id: plan.id,
        name: plan.name,
        serviceId: plan.serviceId,
        sessions: plan.sessions,
        paidSessions: plan.paidSessions,
        bonusSessions: plan.bonusSessions,
        price: plan.price,
        validityDays: plan.validityDays,
        badge: plan.badge,
        isHighlighted: plan.highlight,
        shareable: false,
      },
    });
  }
}

async function seedCustomersAndBookings() {
  for (const customer of customers) {
    const favoriteTherapist = therapists.find((therapist) => therapist.fullName === customer.favoriteTherapist);
    await prisma.customer.create({
      data: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        firstSource: "Dữ liệu demo",
        totalVisits: customer.totalVisits,
        totalSpend: customer.totalSpend,
        segment: customer.segment,
        internalNote: customer.note,
        commonIssues: [],
        favoriteTherapistId: favoriteTherapist?.id,
      },
    });
  }

  await prisma.customerAccount.create({
    data: {
      customerId: customers[0].id,
      phone: customers[0].phone,
      passwordHash: hashPassword(requiredSeedPassword("SEED_CUSTOMER_PASSWORD")),
      phoneVerifiedAt: new Date(),
      creditBalance: 100000,
      welcomeCreditGrantedAt: new Date(),
    },
  });

  const operationUsers = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "MANAGER", "RECEPTIONIST"] } },
    select: { id: true, role: true, branchId: true },
  });

  for (const [index, booking] of bookings.entries()) {
    const service = services.find((item) => item.id === booking.serviceId)!;
    const customer = customers.find((item) => item.phone === booking.customerPhone) ?? customers[0];
    const demoTherapist = therapists.find((item) => item.id === booking.therapistId);
    const branchId = demoTherapist?.branchId ?? (index % 2 === 0 ? "cs1" : "cs2");
    const therapist = await prisma.therapist.findFirst({ where: { branchId, id: booking.therapistId } });
    const roomId = roomIdForServiceCategory(branchId, service.category, index);
    const depositAmount = booking.depositAmount ?? (booking.status === "CANCELLED" ? 0 : Math.round(booking.totalAmount * 0.1));
    const completed = booking.status === "COMPLETED";
    const tipAmount = completed ? (booking.bookingCode === "TAC-DEMO-001" ? 150000 : 70000) : 0;

    const created = await prisma.booking.create({
      data: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        branchId,
        customerId: customer.id,
        serviceId: booking.serviceId,
        therapistId: therapist?.id,
        roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMin: service.durationMin,
        basePrice: service.basePrice,
        therapistFee: service.therapistFee,
        totalAmount: booking.totalAmount,
        depositAmount,
        paidAmount: completed ? booking.totalAmount : depositAmount,
        tipAmount,
        source: booking.source,
        status: booking.status,
        paymentStatus: completed ? "PAID" : depositAmount > 0 ? "DEPOSITED" : "UNPAID",
        completedAt: completed ? booking.endTime : undefined,
      },
    });

    if (completed) {
      const payment = await prisma.paymentTransaction.create({
        data: {
          bookingId: created.id,
          branchId,
          customerId: customer.id,
          type: "SERVICE_PAYMENT",
          direction: "IN",
          status: "CONFIRMED",
          amount: booking.totalAmount,
          method: "DEMO_SEED",
          idempotencyKey: `seed-payment-${created.id}`,
          paidAt: booking.endTime,
        },
      });
      await prisma.ledgerEntry.create({
        data: {
          branchId,
          customerId: customer.id,
          bookingId: created.id,
          paymentTransactionId: payment.id,
          category: "SERVICE_REVENUE",
          dataOrigin: "DEMO",
          direction: "IN",
          amount: booking.totalAmount,
          description: service.name,
          occurredAt: booking.endTime,
        },
      });

      if (tipAmount > 0) {
        const tipPayment = await prisma.paymentTransaction.create({
          data: {
            bookingId: created.id,
            branchId,
            customerId: customer.id,
            type: "TIP",
            direction: "IN",
            status: "CONFIRMED",
            amount: tipAmount,
            method: "DEMO_SEED",
            idempotencyKey: `seed-tip-${created.id}`,
            paidAt: booking.endTime,
          },
        });
        await prisma.ledgerEntry.create({
          data: {
            branchId,
            customerId: customer.id,
            bookingId: created.id,
            paymentTransactionId: tipPayment.id,
            category: "TIP_PAYABLE",
            dataOrigin: "DEMO",
            direction: "IN",
            amount: tipAmount,
            description: `Tip KTV ngoài bill · ${booking.bookingCode}`,
            occurredAt: booking.endTime,
          },
        });
        await prisma.tipPayout.create({
          data: {
            bookingId: created.id,
            therapistId: therapist?.id,
            branchId,
            amount: tipAmount,
            serviceDate: booking.endTime,
            dueAt: booking.endTime,
            status: "PAID",
            paidAt: booking.endTime,
          },
        });
      }
    }

    await prisma.notification.create({
      data: {
        customerId: customer.id,
        branchId,
        type: completed ? "PAYMENT" : "BOOKING",
        title: completed ? "Dịch vụ đã hoàn tất và thanh toán" : "Lịch đặt chỗ đã được xác nhận",
        body: completed
          ? `${service.name}: bill dịch vụ ${booking.totalAmount.toLocaleString("vi-VN")}đ${tipAmount ? `, Tip KTV ngoài bill ${tipAmount.toLocaleString("vi-VN")}đ` : ""}.`
          : `${service.name} tại ${branchConfig.find((item) => item.id === branchId)?.name ?? branchId}; đã cọc ${depositAmount.toLocaleString("vi-VN")}đ.`,
        actionUrl: `/don-cua-toi?booking=${encodeURIComponent(booking.bookingCode)}`,
        createdAt: new Date(Math.min(Date.now(), booking.startTime.getTime() - 60 * 60 * 1000)),
      },
    });

    const recipients = operationUsers.filter((user) => user.role === "OWNER" || user.branchId === branchId);
    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        branchId,
        type: completed ? "FINANCE" as const : "BOOKING" as const,
        title: completed ? `Đã hoàn tất bill · ${customer.fullName}` : `Lịch đã cọc · ${customer.fullName}`,
        body: completed
          ? `${service.name}: doanh thu ${booking.totalAmount.toLocaleString("vi-VN")}đ; Tip KTV tách riêng ${tipAmount.toLocaleString("vi-VN")}đ.`
          : `${booking.bookingCode} · ${service.name} · cọc ${depositAmount.toLocaleString("vi-VN")}đ.`,
        actionUrl: completed ? "/admin/finance" : "/admin/bookings",
        createdAt: new Date(Math.min(Date.now(), booking.startTime.getTime() - 45 * 60 * 1000)),
      })),
    });
  }
}

async function seedOperations(ownerId: string) {
  for (const event of officeEvents) {
    const branchId = event.eventCode.includes("FPT") ? "cs2" : "cs1";
    const leadTherapist = await prisma.therapist.findFirst({ where: { branchId, status: "ACTIVE" }, orderBy: { ratingAvg: "desc" } });
    const customer = await prisma.customer.findUnique({ where: { id: customers[0].id } });
    const requiredTherapists = Math.max(1, Math.ceil(event.registered / 3));
    const subtotalAmount = event.registered * 95_000;
    const transportFee = requiredTherapists * 50_000;
    const totalAmount = subtotalAmount + transportFee;
    const depositAmount = Math.round(totalAmount * 0.1);
    const createdEvent = await prisma.officeEvent.create({
      data: {
        branchId,
        customerId: customer?.id,
        leadTherapistId: leadTherapist?.id,
        eventCode: event.eventCode,
        companyName: event.companyName,
        contactName: customer?.fullName,
        contactPhone: customer?.phone,
        location: event.location,
        serviceLabel: "Chăm sóc cổ vai gáy tiêu chuẩn 20 phút",
        packageTier: "Sức khỏe định kỳ cho cả công ty",
        headcount: event.registered,
        durationMin: 20,
        requiredTherapists,
        sessionsTotal: 8,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        slotMinutes: 20,
        subtotalAmount,
        transportFee,
        totalAmount,
        depositAmount,
        paidAmount: depositAmount,
        paymentStatus: "DEPOSITED",
        status: "READY",
        voucherCode: event.voucherCode,
      },
    });
    if (customer) {
      await prisma.officeRegistration.create({ data: { eventId: createdEvent.id, customerId: customer.id, fullName: customer.fullName, phone: customer.phone, slotTime: event.startsAt, voucherCode: event.voucherCode } });
    }
    const payment = await prisma.paymentTransaction.create({
      data: {
        officeEventId: createdEvent.id,
        branchId,
        customerId: customer?.id,
        type: "DEPOSIT",
        direction: "IN",
        status: "CONFIRMED",
        amount: depositAmount,
        receivedAmount: depositAmount,
        method: "BANK_TRANSFER_SEPAY",
        bankCode: "TCB",
        paymentCode: `TACD${event.eventCode.replace(/[^A-Z0-9]/g, "").slice(-12)}`,
        externalReference: `DEMO-BUSINESS-${event.eventCode}`,
        idempotencyKey: `business-deposit:${event.eventCode}`,
        note: `Đặt cọc Tâm An Business · ${event.companyName}`,
        paidAt: new Date(event.startsAt.getTime() - 2 * 86_400_000),
      },
    });
    await prisma.ledgerEntry.create({ data: { branchId, customerId: customer?.id, officeEventId: createdEvent.id, paymentTransactionId: payment.id, category: "CUSTOMER_DEPOSIT", dataOrigin: "DEMO", direction: "IN", amount: depositAmount, description: `Tiền cọc Business · ${event.companyName}`, occurredAt: payment.paidAt! } });
  }

  const now = new Date();
  const financeRecipients = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "MANAGER"] } },
    select: { id: true, role: true, branchId: true },
  });
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const expenseSeeds = [
    { category: "RENT" as const, description: "Mặt bằng tháng này", amount: 32000000 },
    { category: "SALARY" as const, description: "Tạm ứng lương vận hành", amount: 26000000 },
    { category: "UTILITIES" as const, description: "Điện, nước và giặt sấy", amount: 8500000 },
    { category: "SUPPLIES" as const, description: "Dầu massage và vật tư", amount: 6200000 },
  ];

  for (const branchItem of branchConfig) {
    for (const item of expenseSeeds) {
      const expense = await prisma.expense.create({
        data: {
          branchId: branchItem.id,
          category: item.category,
          description: item.description,
          amount: item.amount + (branchItem.id === "cs2" ? 750000 : 0),
          occurredAt: new Date(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01T09:00:00+07:00`),
          createdByUserId: ownerId,
        },
      });
      const dailyExpense = Math.floor(expense.amount / currentDay);
      for (let day = 1; day <= currentDay; day += 1) {
        await prisma.ledgerEntry.create({
          data: {
            branchId: branchItem.id,
            expenseId: day === 1 ? expense.id : undefined,
            category: "OPERATING_EXPENSE",
            dataOrigin: "DEMO",
            direction: "OUT",
            amount: day === currentDay ? expense.amount - dailyExpense * (currentDay - 1) : dailyExpense,
            description: expense.description,
            occurredAt: new Date(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T20:05:00+07:00`),
          },
        });
      }
      await prisma.notification.createMany({
        data: financeRecipients
          .filter((user) => user.role === "OWNER" || user.branchId === branchItem.id)
          .map((user) => ({
            userId: user.id,
            branchId: branchItem.id,
            type: "FINANCE" as const,
            title: `Đã ghi nhận chi phí · ${branchItem.name}`,
            body: `${expense.description}: ${expense.amount.toLocaleString("vi-VN")}đ đã được hạch toán vào lãi/lỗ cơ sở.`,
            actionUrl: "/admin/finance",
            createdAt: expense.occurredAt,
          })),
      });
    }
  }

  for (const [branchIndex, branchItem] of branchConfig.entries()) {
    for (let month = 0; month < currentMonth; month += 1) {
      const { revenue: monthlyRevenue, expenses: monthlyExpenses } = demoMonthlyFinance(month, branchIndex);
      await prisma.ledgerEntry.create({
        data: {
          branchId: branchItem.id,
          category: "SERVICE_REVENUE",
          dataOrigin: "DEMO",
          direction: "IN",
          amount: monthlyRevenue,
          description: `Doanh thu dịch vụ đã đối soát tháng ${String(month + 1).padStart(2, "0")}/${currentYear}`,
          occurredAt: new Date(`${currentYear}-${String(month + 1).padStart(2, "0")}-28T20:00:00+07:00`),
        },
      });
      await prisma.ledgerEntry.create({
        data: {
          branchId: branchItem.id,
          category: "OPERATING_EXPENSE",
          dataOrigin: "DEMO",
          direction: "OUT",
          amount: monthlyExpenses,
          description: `Tổng chi phí vận hành đã đối soát tháng ${String(month + 1).padStart(2, "0")}/${currentYear}`,
          occurredAt: new Date(`${currentYear}-${String(month + 1).padStart(2, "0")}-28T20:05:00+07:00`),
        },
      });
    }
    for (let day = 1; day <= currentDay; day += 1) {
      const dailyBase = branchIndex === 0 ? 12_000_000 : 12_250_000;
      const dailyRevenue = Math.round(dailyBase * dailyRevenuePattern[(day + branchIndex * 2) % dailyRevenuePattern.length] / 10_000) * 10_000;
      const dailyTips = 920_000 + ((day + branchIndex) % 5) * 70_000;
      const occurredAt = new Date(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T22:30:00+07:00`);
      await prisma.ledgerEntry.createMany({
        data: [
          {
            branchId: branchItem.id,
            category: "SERVICE_REVENUE",
            dataOrigin: "DEMO",
            direction: "IN",
            amount: dailyRevenue,
            description: `Tổng hợp Bill dịch vụ đã đối soát ngày ${String(day).padStart(2, "0")}/${String(currentMonth + 1).padStart(2, "0")}`,
            occurredAt,
          },
          {
            branchId: branchItem.id,
            category: "TIP_PAYABLE",
            dataOrigin: "DEMO",
            direction: "IN",
            amount: dailyTips,
            description: `Tip KTV ngoài Bill ngày ${String(day).padStart(2, "0")}/${String(currentMonth + 1).padStart(2, "0")}`,
            occurredAt,
          },
        ],
      });
    }
  }

  const firstCustomer = await prisma.customer.findFirst();
  if (firstCustomer) {
    await prisma.notification.createMany({
      data: [
        {
          customerId: firstCustomer.id,
          type: "PROMOTION",
          title: "Ưu đãi thành viên mới 100K",
          body: "Tạo tài khoản để nhận 100.000đ cho lần đặt dịch vụ đầu tiên.",
          actionUrl: "/booking",
        },
        {
          userId: ownerId,
          type: "FINANCE",
          title: "Đối soát cuối ngày",
          body: "Tip KTV được tổng hợp riêng và đến hạn chi trả vào cuối ngày.",
          actionUrl: "/admin/finance",
        },
      ],
    });
  }
}

async function seedInvestment(investorId: string, ownerId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const profile = await prisma.investorProfile.create({
    data: {
      userId: investorId,
      investedAmount: 1_800_000_000,
      ownershipPercent: 25,
      profitSharePercent: 25,
      targetAnnualReturn: 24,
      startDate: new Date(`${year}-01-01T00:00:00+07:00`),
      note: "Tài khoản demo. Vốn góp, tỷ lệ sở hữu và lịch phân phối sẽ được cập nhật theo hồ sơ đầu tư chính thức.",
      allocations: {
        create: [
          { branchId: "cs1", allocatedCapital: 850_000_000, ownershipPercent: 25 },
          { branchId: "cs2", allocatedCapital: 950_000_000, ownershipPercent: 25 },
        ],
      },
    },
  });

  for (let month = 0; month < currentMonth; month += 1) {
    const systemProfit = branchConfig.reduce((sum, _branch, branchIndex) => {
      const { revenue, expenses } = demoMonthlyFinance(month, branchIndex);
      return sum + revenue - expenses;
    }, 0);
    const amount = Math.round(systemProfit * 0.25);
    const lastDay = new Date(year, month + 1, 0).getDate();
    await prisma.investorDistribution.create({
      data: {
        investorProfileId: profile.id,
        periodStart: new Date(`${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+07:00`),
        periodEnd: new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59+07:00`),
        amount,
        status: "PAID",
        paidAt: new Date(`${year}-${String(month + 2).padStart(2, "0")}-05T16:00:00+07:00`),
        note: "Phân phối lợi nhuận vận hành đã đối soát",
      },
    });
  }

  await prisma.investmentOpportunity.create({
    data: {
      slug: "mo-moi-dong-da",
      type: "NEW_BRANCH",
      name: "Đề xuất mở mới · Đống Đa",
      area: "Thái Hà – Chùa Bộc, Hà Nội",
      status: "SURVEYING",
      statusLabel: "Khảo sát sơ bộ",
      progressPercent: 46,
      capitalNeed: BigInt(2_400_000_000),
      expressedInterestCapital: BigInt(780_000_000),
      minimumCommitment: BigInt(300_000_000),
      targetReturnRange: "22–27%/năm",
      expectedPaybackPeriod: "Khoảng 32–38 tháng",
      expectedOpening: "Dự kiến Quý I/2027",
      nextUpdate: "Cập nhật khảo sát trong 07 ngày",
      aiAssessment: "Khu vực có mật độ văn phòng và cư dân cao. Hồ sơ vẫn cần xác minh giá thuê, lưu lượng thực tế theo khung giờ và năng lực tuyển dụng trước khi mở nhận cam kết vốn.",
      highlights: [
        "Bán kính tiếp cận nhiều cụm văn phòng và khu dân cư",
        "Mặt bằng đang ở vòng so sánh giá và lưu lượng",
        "Chưa hạch toán vào danh mục cơ sở đang hoạt động",
      ],
      isPublished: true,
      publishedAt: now,
      createdByUserId: ownerId,
      checks: {
        create: [
          { label: "Khảo sát lưu lượng theo ba khung giờ", status: "IN_PROGRESS", sortOrder: 0 },
          { label: "Đối chiếu mặt bằng cùng khu vực", status: "DONE", sortOrder: 1 },
          { label: "Thẩm định pháp lý và hợp đồng thuê", status: "PENDING", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.investmentOpportunity.create({
    data: {
      slug: "thau-lai-my-dinh",
      type: "ACQUISITION",
      name: "Cơ hội thầu lại cơ sở · Mỹ Đình",
      area: "Trần Bình – Mỹ Đình, Hà Nội",
      status: "DUE_DILIGENCE",
      statusLabel: "Đang thẩm định",
      progressPercent: 68,
      capitalNeed: BigInt(1_650_000_000),
      expressedInterestCapital: BigInt(720_000_000),
      minimumCommitment: BigInt(250_000_000),
      targetReturnRange: "20–25%/năm",
      expectedPaybackPeriod: "Khoảng 28–34 tháng",
      expectedOpening: "Dự kiến tháng 11/2026",
      nextUpdate: "Cập nhật pháp lý trong 04 ngày",
      aiAssessment: "Phương án có lợi thế thời gian triển khai nhờ tài sản sẵn có, nhưng cần hoàn tất kiểm kê, xác minh nghĩa vụ thuê và đánh giá chi phí cải tạo trước khi chốt phương án đầu tư.",
      highlights: [
        "Có sẵn hạ tầng cơ bản để rút ngắn thời gian triển khai",
        "Đang kiểm kê tài sản và nghĩa vụ bàn giao",
        "Dòng tiền dự kiến chưa được ghi nhận vào báo cáo vận hành",
      ],
      isPublished: true,
      publishedAt: now,
      createdByUserId: ownerId,
      checks: {
        create: [
          { label: "Kiểm kê tài sản bàn giao", status: "DONE", sortOrder: 0 },
          { label: "Rà soát hợp đồng thuê và công nợ", status: "IN_PROGRESS", sortOrder: 1 },
          { label: "Dự toán cải tạo theo tiêu chuẩn Tâm An", status: "PENDING", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.investorBenefit.createMany({
    data: [
      { slug: "signature-quarterly", title: "04 buổi Signature mỗi quý", detail: "Chăm sóc sức khỏe định kỳ dành cho Nhà đầu tư hoặc người thân được chỉ định.", badge: "Sức khỏe", sortOrder: 0 },
      { slug: "private-room-priority", title: "Ưu tiên phòng riêng", detail: "Ưu tiên sắp xếp không gian tiếp đón riêng khi đi cùng gia đình hoặc đối tác.", badge: "Ưu tiên", sortOrder: 1 },
      { slug: "early-opportunity-access", title: "Quyền xem cơ hội sớm", detail: "Nhận bản tin khảo sát và hồ sơ sơ bộ trước khi cơ hội được công bố rộng hơn.", badge: "Thông tin sớm", sortOrder: 2 },
      { slug: "business-partner-welcome", title: "Tiếp đón đối tác Business", detail: "Đội ngũ Investor Care hỗ trợ lên lịch và tiếp đón đối tác theo tiêu chuẩn Tâm An Business.", badge: "Đối tác", sortOrder: 3 },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: investorId,
        type: "FINANCE",
        title: "Hồ sơ mở mới đang khảo sát · Đống Đa",
        body: "Đây là cơ hội mới ngoài danh mục đang vận hành. Đội ngũ đã khảo sát sơ bộ 46%; nhu cầu vốn dự kiến 2,4 tỷ đồng, chưa mở cam kết vốn.",
        actionUrl: "/admin#opportunities",
        createdAt: new Date(now.getTime() - 35 * 60 * 1000),
      },
      {
        userId: investorId,
        type: "FINANCE",
        title: "Cơ hội thầu lại cơ sở · Mỹ Đình",
        body: "Đây là cơ hội mới ngoài danh mục đang vận hành, đang rà soát hợp đồng thuê và tài sản bàn giao. Mức quan tâm dự kiến từ 250 triệu đồng, chưa mở cam kết vốn.",
        actionUrl: "/admin#opportunities",
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        userId: investorId,
        type: "SYSTEM",
        title: "Phiên cập nhật Nhà đầu tư tháng 7",
        body: "Admin Tâm An mời xem báo cáo vận hành, kế hoạch mở rộng và phần hỏi đáp lúc 20:00 ngày 25/07/2026.",
        actionUrl: "/admin#updates",
        createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      },
      {
        userId: investorId,
        type: "PROMOTION",
        title: "Đặc quyền sức khỏe dành riêng Nhà đầu tư",
        body: "Tặng 04 buổi chăm sóc Signature mỗi quý và quyền ưu tiên đặt phòng riêng cho gia đình hoặc đối tác.",
        actionUrl: "/admin#benefits",
        createdAt: new Date(now.getTime() - 2 * 86_400_000),
      },
      {
        userId: investorId,
        type: "FINANCE",
        title: "Lợi nhuận kỳ tháng 06 đã phân phối",
        body: "46.925.000đ đã được ghi nhận vào lịch sử phân phối sau khi đối soát toàn hệ thống.",
        actionUrl: "/admin#updates",
        readAt: new Date(now.getTime() - 3 * 86_400_000),
        createdAt: new Date(now.getTime() - 3 * 86_400_000),
      },
    ],
  });
}

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== DESTRUCTIVE_SEED_CONFIRMATION) {
    throw new Error(`Seed bị chặn để bảo vệ dữ liệu. Chỉ dùng cho CSDL demo trống và đặt ALLOW_DESTRUCTIVE_SEED=${DESTRUCTIVE_SEED_CONFIRMATION}.`);
  }
  validateSeedPasswords();
  await clearDatabase();
  const { owner, investor, xgroup, districtManagerCauGiay, districtManagerHaDong } = await seedBranchesAndStaff();
  await seedCatalog();
  await seedCustomersAndBookings();
  await seedOperations(owner.id);
  await seedXgroup(owner.id, xgroup.id, districtManagerCauGiay.id, districtManagerHaDong.id);
  await seedInvestment(investor.id, owner.id);

  const summary = await Promise.all([
    prisma.branch.count(),
    prisma.therapist.count(),
    prisma.room.count(),
    prisma.booking.count(),
    prisma.ledgerEntry.count(),
  ]);
  console.log(`Seeded ${summary[0]} branches, ${summary[1]} KTV, ${summary[2]} seats, ${summary[3]} bookings and ${summary[4]} ledger entries.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
