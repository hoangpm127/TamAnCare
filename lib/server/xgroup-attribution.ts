import "server-only";

import { addDays } from "date-fns";
import type { Prisma } from "@/app/generated/prisma/client";
import { BUSINESS_DISTRIBUTION_LABELS, BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "@/lib/business-distribution";

type BusinessClient = Prisma.TransactionClient;

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function inferDistrict(tx: BusinessClient, address: string) {
  const addressKey = normalized(address);
  const districts = await tx.businessDistrict.findMany({ where: { isActive: true }, include: { manager: true }, orderBy: { name: "asc" } });
  return districts.find((district) => addressKey.includes(normalized(district.name).replace(/^quan\s+/, ""))) ?? null;
}

export async function attachBusinessAttribution(tx: BusinessClient, input: {
  officeEventId: string;
  eventCode: string;
  companyName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  officeAddress: string;
  grossAmount: number;
  referralCode?: string | null;
}) {
  const referralCode = input.referralCode?.trim().toUpperCase() || null;
  const asset = referralCode
    ? await tx.businessMediaAsset.findFirst({
        where: {
          code: referralCode,
          status: "ACTIVE",
          OR: [{ affiliateId: null }, { affiliate: { is: { status: "ACTIVE" } } }],
        },
        include: { affiliate: { include: { district: { include: { manager: true } } } }, district: { include: { manager: true } } },
      })
    : null;
  const directAffiliate = !asset && referralCode
    ? await tx.businessAffiliate.findFirst({
        where: { code: referralCode, status: "ACTIVE" },
        include: { district: { include: { manager: true } } },
      })
    : null;
  const affiliate = asset?.affiliate ?? directAffiliate;
  const district = asset?.district ?? affiliate?.district ?? await inferDistrict(tx, input.officeAddress);
  const sourceLabel = asset
    ? `${asset.type} · ${asset.title}`
    : affiliate
      ? `Affiliate trực tiếp · ${affiliate.displayName}`
      : referralCode
        ? `Mã chưa quy thuộc · ${referralCode}`
        : "Trực tiếp / chưa quy thuộc";

  const lead = await tx.businessLead.upsert({
    where: { officeEventId: input.officeEventId },
    create: {
      leadCode: `LEAD-${input.eventCode}`,
      districtId: district?.id,
      affiliateId: affiliate?.id,
      sourceAssetId: asset?.id,
      officeEventId: input.officeEventId,
      ownerUserId: district?.managerUserId,
      companyName: input.companyName,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      officeAddress: input.officeAddress,
      estimatedGmv: input.grossAmount,
      stage: "AWAITING_DEPOSIT",
      nextActionAt: addDays(new Date(), 1),
      nextAction: "Theo dõi đối soát cọc và chốt lịch triển khai",
    },
    update: {
      districtId: district?.id,
      affiliateId: affiliate?.id,
      sourceAssetId: asset?.id,
      ownerUserId: district?.managerUserId,
      companyName: input.companyName,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      officeAddress: input.officeAddress,
      estimatedGmv: input.grossAmount,
    },
  });

  const attribution = await tx.businessAttribution.upsert({
    where: { officeEventId: input.officeEventId },
    create: {
      officeEventId: input.officeEventId,
      districtId: district?.id,
      affiliateId: affiliate?.id,
      sourceAssetId: asset?.id,
      sourceLabel,
      grossAmount: input.grossAmount,
      tipExcludedAmount: 0,
    },
    update: {
      districtId: district?.id,
      affiliateId: affiliate?.id,
      sourceAssetId: asset?.id,
      sourceLabel,
      grossAmount: input.grossAmount,
    },
  });

  const split = calculateBusinessDistribution(input.grossAmount);
  const beneficiary: Record<keyof typeof BUSINESS_DISTRIBUTION_RATES, { label: string; reference?: string }> = {
    KTV_DIRECT: { label: "Đội KTV trực tiếp triển khai" },
    TEAM_LEADER: { label: "KTV Business trưởng (chờ phân công)" },
    XGROUP_PLATFORM: { label: "Nền tảng Xgroup", reference: "XGROUP" },
    DISTRICT_DIRECTOR: { label: district?.manager?.name ?? `Giám đốc phân phối ${district?.name ?? "chờ gán Quận"}`, reference: district?.managerUserId ?? undefined },
    DIRECT_AFFILIATE: { label: affiliate?.displayName ?? "Affiliate trực tiếp chờ quy thuộc", reference: affiliate?.id },
  };
  for (const recipient of Object.keys(BUSINESS_DISTRIBUTION_RATES) as Array<keyof typeof BUSINESS_DISTRIBUTION_RATES>) {
    await tx.businessAllocation.upsert({
      where: { attributionId_recipient: { attributionId: attribution.id, recipient } },
      create: {
        attributionId: attribution.id,
        recipient,
        rateBps: BUSINESS_DISTRIBUTION_RATES[recipient],
        amount: split[recipient],
        beneficiaryLabel: beneficiary[recipient].label || BUSINESS_DISTRIBUTION_LABELS[recipient],
        beneficiaryReference: beneficiary[recipient].reference,
        status: "PENDING",
      },
      update: {
        rateBps: BUSINESS_DISTRIBUTION_RATES[recipient],
        amount: split[recipient],
        beneficiaryLabel: beneficiary[recipient].label || BUSINESS_DISTRIBUTION_LABELS[recipient],
        beneficiaryReference: beneficiary[recipient].reference,
      },
    });
  }
  if (asset) await tx.businessMediaAsset.update({ where: { id: asset.id }, data: { leadCount: { increment: 1 } } });
  return { attribution, lead, district, affiliate, asset };
}

export async function markBusinessLeadStage(tx: BusinessClient, officeEventId: string, stage: "SCHEDULED" | "IN_SERVICE" | "WON" | "LOST") {
  await tx.businessLead.updateMany({
    where: { officeEventId },
    data: {
      stage,
      nextActionAt: stage === "WON" || stage === "LOST" ? null : undefined,
      nextAction: stage === "WON" ? "Đã hoàn tất · chuyển chăm sóc tái ký" : stage === "IN_SERVICE" ? "Theo dõi chất lượng triển khai và chốt Bill" : undefined,
    },
  });
  if (stage !== "WON") return;
  const attribution = await tx.businessAttribution.findUnique({
    where: { officeEventId },
    include: { district: { include: { manager: true } }, affiliate: true, officeEvent: { select: { eventCode: true, companyName: true, totalAmount: true } } },
  });
  if (!attribution) return;
  const now = new Date();
  const activated = await tx.businessAllocation.updateMany({
    where: { attributionId: attribution.id, status: "PENDING" },
    data: { status: "READY", dueAt: addDays(now, 7) },
  });
  if (activated.count === 0) return;
  const recipients = await tx.user.findMany({
    where: { isActive: true, OR: [{ role: "XGROUP_SUPER_ADMIN" }, ...(attribution.district?.managerUserId ? [{ id: attribution.district.managerUserId }] : [])] },
    select: { id: true },
  });
  if (recipients.length) {
    await tx.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "FINANCE" as const,
        title: `Business sẵn sàng đối soát · ${attribution.officeEvent.companyName}`,
        body: `${attribution.district?.name ?? "Chưa phân tuyến"} · GMV ${attribution.officeEvent.totalAmount.toLocaleString("vi-VN")}đ · ${attribution.affiliate?.displayName ?? "nguồn trực tiếp"}.`,
        actionUrl: "/xgroup/reconciliation",
      })),
    });
  }
}
