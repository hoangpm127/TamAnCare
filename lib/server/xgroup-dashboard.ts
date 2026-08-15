import "server-only";

import { differenceInCalendarDays } from "date-fns";
import { absoluteAffiliateLink } from "@/lib/affiliate-link";
import { db } from "@/lib/db";
import { BUSINESS_DISTRIBUTION_LABELS, BUSINESS_DISTRIBUTION_RATES, calculateBusinessDistribution } from "@/lib/business-distribution";
import { reportsIncludeDemoLedger } from "@/lib/server/ledger-reporting";
import { resolveXgroupScope, type requireXgroupSession } from "@/lib/server/xgroup-access";
import type { XgroupDashboardData } from "@/lib/xgroup-types";

const GLOBAL_ANNUAL_GMV_TARGET = 52_200_000_000;
const TZ = "Asia/Ho_Chi_Minh";

type XgroupSession = NonNullable<Awaited<ReturnType<typeof requireXgroupSession>>>;

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function monthKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(value);
}

function defaultRange() {
  const key = monthKey(new Date());
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, "0")}` };
}

function parseRange(from?: string | null, to?: string | null) {
  const fallback = defaultRange();
  const fromKey = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : fallback.from;
  const toKey = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : fallback.to;
  const start = new Date(`${fromKey}T00:00:00+07:00`);
  const end = new Date(`${toKey}T23:59:59.999+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return parseRange(fallback.from, fallback.to);
  return { from: fromKey, to: toKey, start, end };
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.min(999, Math.round(numerator / denominator * 10_000) / 100) : 0;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    AWAITING_DEPOSIT: "Chờ cọc",
    DEPOSIT_CONFIRMED: "Đã nhận cọc",
    READY: "Sẵn sàng",
    IN_SERVICE: "Đang triển khai",
    AWAITING_BALANCE: "Chờ thanh toán",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
  };
  return labels[value] ?? value;
}

export async function getXgroupDashboard(session: XgroupSession, input: { from?: string | null; to?: string | null; districtId?: string | null } = {}): Promise<XgroupDashboardData> {
  const range = parseRange(input.from, input.to);
  const scope = await resolveXgroupScope(session, input.districtId);
  if (!scope) throw new Error("XGROUP_SCOPE_UNAVAILABLE");
  const districtId = scope.districtId;
  const districtWhere = districtId ? { id: districtId } : {};
  const attributionScope = districtId ? { businessAttribution: { is: { districtId } } } : {};

  // Tuần tự để giữ tương thích PGlite UAT và PostgreSQL managed.
  const districts = await db.businessDistrict.findMany({
    where: districtWhere,
    include: { manager: { select: { id: true, name: true, username: true } } },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
  const events = await db.officeEvent.findMany({
    where: { startsAt: { gte: range.start, lte: range.end }, status: { not: "CANCELLED" }, ...attributionScope },
    include: {
      branch: { select: { id: true, name: true } },
      leadTherapist: { select: { id: true, fullName: true } },
      tipPayout: { select: { amount: true } },
      businessAttribution: {
        include: {
          district: { select: { id: true, name: true } },
          affiliate: { select: { id: true, displayName: true, code: true } },
          sourceAsset: { select: { id: true, title: true, code: true, type: true } },
          allocations: { orderBy: { rateBps: "desc" } },
        },
      },
    },
    orderBy: { startsAt: "desc" },
  });
  const affiliates = await db.businessAffiliate.findMany({
    where: districtId ? { districtId } : {},
    include: { district: { select: { id: true, name: true } }, assets: { select: { id: true, clickCount: true, leadCount: true } } },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
  });
  const assets = await db.businessMediaAsset.findMany({
    where: districtId ? { districtId } : {},
    include: { district: { select: { id: true, name: true } }, affiliate: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const leads = await db.businessLead.findMany({
    where: districtId ? { districtId } : {},
    include: { district: { select: { id: true, name: true } }, affiliate: { select: { displayName: true } }, sourceAsset: { select: { title: true, type: true } } },
    orderBy: [{ nextActionAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const managers = scope.canManageAllDistricts
    ? await db.user.findMany({
        where: { role: "DISTRICT_SALES_MANAGER", isActive: true },
        include: { managedBusinessDistrict: { select: { id: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const completedEvents = events.filter((event) => event.status === "COMPLETED");
  const bookedGmv = events.reduce((sum, event) => sum + event.totalAmount, 0);
  const recognizedGmv = completedEvents.reduce((sum, event) => sum + event.totalAmount, 0);
  const collected = events.reduce((sum, event) => sum + Math.min(event.paidAmount, event.totalAmount), 0);
  const receivable = events.reduce((sum, event) => sum + Math.max(0, event.totalAmount - event.paidAmount), 0);
  const depositCollected = events.reduce((sum, event) => sum + Math.min(event.paidAmount, event.depositAmount), 0);
  const tipExcluded = events.reduce((sum, event) => sum + (event.tipPayout?.amount ?? 0), 0);
  const allocation = calculateBusinessDistribution(recognizedGmv);
  const annualTarget = districts.reduce((sum, district) => sum + Number(district.annualGmvTarget), 0)
    || (districtId ? Math.round(GLOBAL_ANNUAL_GMV_TARGET / 6) : GLOBAL_ANNUAL_GMV_TARGET);
  const periodDays = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const yearDays = new Date(range.start.getFullYear(), 1, 29).getMonth() === 1 ? 366 : 365;
  const targetGmv = Math.round(annualTarget * Math.min(periodDays, yearDays) / yearDays);

  const attributedEventCount = events.filter((event) => event.businessAttribution).length;
  const unassigned = events.filter((event) => !event.businessAttribution?.districtId || !event.businessAttribution?.affiliateId);
  const overdueAllocationCount = events.reduce((sum, event) => sum + (event.businessAttribution?.allocations.filter((item) => item.dueAt && item.dueAt < new Date() && !["PAID", "VOID"].includes(item.status)).length ?? 0), 0);
  const pendingComplianceCount = affiliates.filter((item) => item.conflictDisclosureRequired && !item.conflictDisclosureAcceptedAt).length;

  const groupByMonth = periodDays > 45;
  const seriesMap = new Map<string, { key: string; label: string; gmv: number; collected: number; xgroup: number }>();
  for (const event of events) {
    const key = groupByMonth ? monthKey(event.startsAt) : dateKey(event.startsAt);
    const label = groupByMonth ? `T${Number(key.slice(5, 7))}/${key.slice(0, 4)}` : `${key.slice(8, 10)}/${key.slice(5, 7)}`;
    const current = seriesMap.get(key) ?? { key, label, gmv: 0, collected: 0, xgroup: 0 };
    current.gmv += event.totalAmount;
    current.collected += Math.min(event.paidAmount, event.totalAmount);
    if (event.status === "COMPLETED") current.xgroup += calculateBusinessDistribution(event.totalAmount).XGROUP_PLATFORM;
    seriesMap.set(key, current);
  }

  const districtRows = districts.map((district) => {
    const scopedEvents = events.filter((event) => event.businessAttribution?.districtId === district.id);
    const scopedCompleted = scopedEvents.filter((event) => event.status === "COMPLETED");
    const scopedLeads = leads.filter((lead) => lead.districtId === district.id);
    const gmv = scopedCompleted.reduce((sum, event) => sum + event.totalAmount, 0);
    const districtTarget = Number(district.annualGmvTarget);
    const periodTarget = Math.round(districtTarget * Math.min(periodDays, yearDays) / yearDays);
    return {
      id: district.id,
      code: district.code,
      name: district.name,
      city: district.city,
      managerName: district.manager?.name ?? "Chưa bổ nhiệm",
      annualTarget: districtTarget,
      gmv,
      collected: scopedEvents.reduce((sum, event) => sum + Math.min(event.paidAmount, event.totalAmount), 0),
      progress: percent(gmv, periodTarget),
      eventCount: scopedEvents.length,
      companyCount: new Set(scopedEvents.map((event) => event.companyName)).size,
      activeAffiliateCount: affiliates.filter((item) => item.districtId === district.id && item.status === "ACTIVE").length,
      leadCount: scopedLeads.length,
      conversionRate: percent(scopedCompleted.length, scopedLeads.length || scopedEvents.length),
    };
  });

  const affiliateRows = affiliates.map((affiliate) => {
    const scopedEvents = events.filter((event) => event.businessAttribution?.affiliateId === affiliate.id);
    const completed = scopedEvents.filter((event) => event.status === "COMPLETED");
    const scopedLeads = leads.filter((lead) => lead.affiliateId === affiliate.id);
    const gmv = completed.reduce((sum, event) => sum + event.totalAmount, 0);
    const clicks = affiliate.assets.reduce((sum, asset) => sum + asset.clickCount, 0);
    return {
      id: affiliate.id,
      code: affiliate.code,
      displayName: affiliate.displayName,
      organization: affiliate.organization,
      title: affiliate.title,
      phone: affiliate.phone,
      email: affiliate.email,
      profile: affiliate.referrerProfile,
      districtId: affiliate.districtId,
      districtName: affiliate.district.name,
      status: affiliate.status,
      commissionRateBps: affiliate.commissionRateBps,
      conflictDisclosureRequired: affiliate.conflictDisclosureRequired,
      conflictDisclosureAccepted: Boolean(affiliate.conflictDisclosureAcceptedAt),
      complianceNote: affiliate.complianceNote,
      clickCount: clicks,
      leadCount: scopedLeads.length,
      completedCount: completed.length,
      conversionRate: percent(completed.length, scopedLeads.length || clicks),
      gmv,
      commission: Math.floor(gmv * affiliate.commissionRateBps / 10_000),
      assetCount: affiliate.assets.length,
    };
  });

  const assetRows = assets.map((asset) => {
    const scopedEvents = events.filter((event) => event.businessAttribution?.sourceAssetId === asset.id);
    const completed = scopedEvents.filter((event) => event.status === "COMPLETED");
    return {
      id: asset.id,
      code: asset.code,
      type: asset.type,
      title: asset.title,
      status: asset.status,
      districtId: asset.districtId,
      districtName: asset.district?.name ?? "Toàn hệ thống",
      affiliateId: asset.affiliateId,
      affiliateName: asset.affiliate?.displayName ?? "Nguồn Xgroup",
      destinationPath: asset.destinationPath,
      videoUrl: asset.videoUrl,
      trackingPath: absoluteAffiliateLink(`/xg-ref/${encodeURIComponent(asset.code)}`),
      clickCount: asset.clickCount,
      leadCount: asset.leadCount,
      completedCount: completed.length,
      conversionRate: percent(completed.length, asset.leadCount || asset.clickCount),
      gmv: completed.reduce((sum, event) => sum + event.totalAmount, 0),
    };
  });

  const eventRows = events.map((event) => {
    const computed = calculateBusinessDistribution(event.totalAmount);
    const attribution = event.businessAttribution;
    const allocations = attribution?.allocations.length
      ? attribution.allocations.map((item) => ({
          id: item.id,
          recipient: item.recipient,
          label: BUSINESS_DISTRIBUTION_LABELS[item.recipient],
          amount: item.amount,
          rateBps: item.rateBps,
          beneficiaryLabel: item.beneficiaryLabel,
          status: item.status,
          dueAt: item.dueAt?.toISOString() ?? null,
          paidAt: item.paidAt?.toISOString() ?? null,
          bankReference: item.bankReference,
        }))
      : (Object.keys(BUSINESS_DISTRIBUTION_RATES) as Array<keyof typeof BUSINESS_DISTRIBUTION_RATES>).map((recipient) => ({
          id: `${event.id}:${recipient}`,
          recipient,
          label: BUSINESS_DISTRIBUTION_LABELS[recipient],
          amount: computed[recipient],
          rateBps: BUSINESS_DISTRIBUTION_RATES[recipient],
          beneficiaryLabel: "Chưa quy thuộc dữ liệu nguồn",
          status: "PENDING",
          dueAt: null,
          paidAt: null,
          bankReference: null,
        }));
    return {
      id: event.id,
      eventCode: event.eventCode,
      companyName: event.companyName,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      status: statusLabel(event.status),
      districtName: attribution?.district?.name ?? "Chưa phân tuyến",
      affiliateName: attribution?.affiliate?.displayName ?? "Chưa quy thuộc",
      sourceLabel: attribution?.sourceLabel ?? "Dữ liệu cũ · chưa gắn nguồn",
      gmv: event.totalAmount,
      paidAmount: event.paidAmount,
      receivable: Math.max(0, event.totalAmount - event.paidAmount),
      allocations,
    };
  });

  const districtLabel = districtId ? districts[0]?.name ?? "Chưa được gán Quận" : "Toàn bộ Tâm An Business";
  return {
    generatedAt: new Date().toISOString(),
    reportingMode: reportsIncludeDemoLedger() ? "UAT_WITH_DEMO" : "PRODUCTION_LIVE_ONLY",
    scope: {
      role: session.role,
      districtId: districtId === "__unassigned__" ? null : districtId,
      districtLabel,
      canManageAllDistricts: scope.canManageAllDistricts,
      canApprovePayouts: scope.canApprovePayouts,
    },
    range: { from: range.from, to: range.to, label: `${range.from.split("-").reverse().join("/")} – ${range.to.split("-").reverse().join("/")}`, targetGmv },
    finance: {
      bookedGmv,
      recognizedGmv,
      collected,
      receivable,
      depositCollected,
      tipExcluded,
      annualTarget,
      targetProgress: percent(recognizedGmv, targetGmv),
      eventCount: events.length,
      completedCount: completedEvents.length,
      activeCompanyCount: new Set(events.map((event) => event.companyName)).size,
      allocation: {
        grossAmount: allocation.grossAmount,
        deliveryTeamAmount: allocation.deliveryTeamAmount,
        platformAndDistributionAmount: allocation.platformAndDistributionAmount,
        ktvDirect: allocation.KTV_DIRECT,
        teamLeader: allocation.TEAM_LEADER,
        xgroupPlatform: allocation.XGROUP_PLATFORM,
        districtDirector: allocation.DISTRICT_DIRECTOR,
        directAffiliate: allocation.DIRECT_AFFILIATE,
      },
    },
    quality: {
      attributionCoveragePercent: percent(attributedEventCount, events.length),
      attributedEventCount,
      unassignedEventCount: unassigned.length,
      unassignedGmv: unassigned.reduce((sum, event) => sum + event.totalAmount, 0),
      pendingComplianceCount,
      overdueAllocationCount,
    },
    series: [...seriesMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    districts: districtRows,
    affiliates: affiliateRows,
    assets: assetRows,
    leads: leads.map((lead) => ({
      id: lead.id,
      leadCode: lead.leadCode,
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactPhone: lead.contactPhone,
      officeAddress: lead.officeAddress,
      districtId: lead.districtId,
      districtName: lead.district?.name ?? "Chưa phân tuyến",
      affiliateName: lead.affiliate?.displayName ?? "Chưa quy thuộc",
      sourceLabel: lead.sourceAsset ? `${lead.sourceAsset.type} · ${lead.sourceAsset.title}` : "Trực tiếp / nhập tay",
      stage: lead.stage,
      estimatedGmv: lead.estimatedGmv,
      nextActionAt: lead.nextActionAt?.toISOString() ?? null,
      nextAction: lead.nextAction,
      createdAt: lead.createdAt.toISOString(),
    })),
    events: eventRows,
    managers: managers.map((manager) => ({ id: manager.id, name: manager.name, username: manager.username, districtId: manager.managedBusinessDistrict?.id ?? null })),
  };
}
