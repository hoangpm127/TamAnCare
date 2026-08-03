import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "../lib/business-distribution";
import { hashPassword } from "../lib/password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL chưa được cấu hình.");

function requiredPassword(name: string) {
  const value = process.env[name];
  if (!value || value.length < 10) throw new Error(`${name} phải có ít nhất 10 ký tự và chỉ dùng cho môi trường được kiểm soát.`);
  return value;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const superPassword = requiredPassword("XGROUP_SUPERADMIN_PASSWORD");
  const districtPassword = requiredPassword("XGROUP_DISTRICT_MANAGER_PASSWORD");
  const xgroup = await prisma.user.upsert({
    where: { username: "xgroup.superadmin" },
    create: { name: "Xgroup Super Admin", username: "xgroup.superadmin", email: "superadmin@xgroup.local", passwordHash: hashPassword(superPassword), passwordChangedAt: new Date(), role: "XGROUP_SUPER_ADMIN", isActive: true },
    update: { name: "Xgroup Super Admin", passwordHash: hashPassword(superPassword), passwordChangedAt: new Date(), role: "XGROUP_SUPER_ADMIN", isActive: true },
  });
  const managerCauGiay = await prisma.user.upsert({
    where: { username: "truongphong.caugiay" },
    create: { name: "Trưởng phòng KD Quận Cầu Giấy", username: "truongphong.caugiay", email: "sales.caugiay@xgroup.local", passwordHash: hashPassword(districtPassword), passwordChangedAt: new Date(), role: "DISTRICT_SALES_MANAGER", isActive: true },
    update: { name: "Trưởng phòng KD Quận Cầu Giấy", passwordHash: hashPassword(districtPassword), passwordChangedAt: new Date(), role: "DISTRICT_SALES_MANAGER", isActive: true },
  });
  const managerHaDong = await prisma.user.upsert({
    where: { username: "truongphong.hadong" },
    create: { name: "Trưởng phòng KD Quận Hà Đông", username: "truongphong.hadong", email: "sales.hadong@xgroup.local", passwordHash: hashPassword(districtPassword), passwordChangedAt: new Date(), role: "DISTRICT_SALES_MANAGER", isActive: true },
    update: { name: "Trưởng phòng KD Quận Hà Đông", passwordHash: hashPassword(districtPassword), passwordChangedAt: new Date(), role: "DISTRICT_SALES_MANAGER", isActive: true },
  });
  const cauGiay = await prisma.businessDistrict.upsert({ where: { code: "CAU_GIAY" }, create: { code: "CAU_GIAY", name: "Quận Cầu Giấy", city: "Hà Nội", managerUserId: managerCauGiay.id, annualGmvTarget: BigInt(26_100_000_000) }, update: { name: "Quận Cầu Giấy", managerUserId: managerCauGiay.id, annualGmvTarget: BigInt(26_100_000_000), isActive: true } });
  const haDong = await prisma.businessDistrict.upsert({ where: { code: "HA_DONG" }, create: { code: "HA_DONG", name: "Quận Hà Đông", city: "Hà Nội", managerUserId: managerHaDong.id, annualGmvTarget: BigInt(26_100_000_000) }, update: { name: "Quận Hà Đông", managerUserId: managerHaDong.id, annualGmvTarget: BigInt(26_100_000_000), isActive: true } });

  const affiliateSpecs = [
    { code: "CEO-CG-001", districtId: cauGiay.id, displayName: "Nguyễn Minh Anh", organization: "Đối tác doanh nghiệp Cầu Giấy", title: "Giám đốc", referrerProfile: "CEO giới thiệu trực tiếp" },
    { code: "TOWER-HD-001", districtId: haDong.id, displayName: "Phạm Lan Chi", organization: "Đối tác tòa nhà Hà Đông", title: "Quản lý tòa nhà", referrerProfile: "Đầu mối tòa văn phòng" },
  ];
  const affiliates = [];
  for (const spec of affiliateSpecs) {
    affiliates.push(await prisma.businessAffiliate.upsert({ where: { code: spec.code }, create: { ...spec, status: "ACTIVE", commissionRateBps: 1000, conflictDisclosureRequired: true, conflictDisclosureAcceptedAt: new Date(), complianceNote: "Hồ sơ UAT đã lưu công bố lợi ích mẫu.", createdByUserId: xgroup.id }, update: { ...spec, status: "ACTIVE", commissionRateBps: 1000 } }));
  }
  const assetSpecs = [
    { code: "QR-CG-CEO01", districtId: cauGiay.id, affiliateId: affiliates[0].id, type: "QR" as const, title: "QR Business · Cầu Giấy", destinationPath: "/doanh-nghiep" },
    { code: "LINK-HD-TOWER", districtId: haDong.id, affiliateId: affiliates[1].id, type: "LINK" as const, title: "Link Business · Hà Đông", destinationPath: "/doanh-nghiep" },
  ];
  const assets = [];
  for (const spec of assetSpecs) assets.push(await prisma.businessMediaAsset.upsert({ where: { code: spec.code }, create: { ...spec, status: "ACTIVE", createdByUserId: xgroup.id }, update: { ...spec, status: "ACTIVE" } }));

  const events = await prisma.officeEvent.findMany({ where: { businessAttribution: null }, orderBy: { createdAt: "asc" } });
  for (const [index, event] of events.entries()) {
    const district = /hà đông|ha dong/i.test(event.location) ? haDong : index % 2 ? haDong : cauGiay;
    const affiliate = district.id === cauGiay.id ? affiliates[0] : affiliates[1];
    const asset = district.id === cauGiay.id ? assets[0] : assets[1];
    const leadStage = event.status === "COMPLETED" ? "WON" : event.status === "IN_SERVICE" ? "IN_SERVICE" : ["READY", "DEPOSIT_CONFIRMED"].includes(event.status) ? "SCHEDULED" : "AWAITING_DEPOSIT";
    await prisma.businessLead.upsert({ where: { officeEventId: event.id }, create: { leadCode: `LEAD-${event.eventCode}`, districtId: district.id, affiliateId: affiliate.id, sourceAssetId: asset.id, officeEventId: event.id, ownerUserId: district.managerUserId, companyName: event.companyName, contactName: event.contactName, contactPhone: event.contactPhone, officeAddress: event.location, estimatedGmv: event.totalAmount, stage: leadStage }, update: { districtId: district.id, affiliateId: affiliate.id, sourceAssetId: asset.id, stage: leadStage, estimatedGmv: event.totalAmount } });
    const attribution = await prisma.businessAttribution.create({ data: { officeEventId: event.id, districtId: district.id, affiliateId: affiliate.id, sourceAssetId: asset.id, sourceLabel: `${asset.type} · ${asset.title}`, grossAmount: event.totalAmount, tipExcludedAmount: 0 } });
    const split = calculateBusinessDistribution(event.totalAmount);
    for (const recipient of Object.keys(BUSINESS_DISTRIBUTION_RATES) as Array<keyof typeof BUSINESS_DISTRIBUTION_RATES>) {
      await prisma.businessAllocation.create({ data: { attributionId: attribution.id, recipient, rateBps: BUSINESS_DISTRIBUTION_RATES[recipient], amount: split[recipient], beneficiaryLabel: recipient === "XGROUP_PLATFORM" ? "Nền tảng Xgroup" : recipient === "DISTRICT_DIRECTOR" ? (district.id === cauGiay.id ? managerCauGiay.name : managerHaDong.name) : recipient === "DIRECT_AFFILIATE" ? affiliate.displayName : recipient === "TEAM_LEADER" ? "KTV Business trưởng" : "Đội KTV trực tiếp triển khai", beneficiaryReference: recipient === "XGROUP_PLATFORM" ? "XGROUP" : recipient === "DISTRICT_DIRECTOR" ? district.managerUserId : recipient === "DIRECT_AFFILIATE" ? affiliate.id : null, status: event.status === "COMPLETED" ? "READY" : "PENDING", dueAt: event.status === "COMPLETED" ? new Date(Date.now() + 7 * 86_400_000) : null } });
    }
  }
  console.log(`Xgroup provisioned: ${xgroup.username}; 2 district managers; ${affiliates.length} affiliates; ${assets.length} assets; ${events.length} existing Business events attributed.`);
}

main().finally(() => prisma.$disconnect());

