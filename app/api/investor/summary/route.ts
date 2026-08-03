import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { ledgerReportWhere, summarizeLedgerOrigins } from "@/lib/server/ledger-reporting";

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const RANGE_VALUES = ["today", "week", "month", "quarter", "year", "custom"] as const;
type RangeKey = (typeof RANGE_VALUES)[number];
type FinancialEntry = Awaited<ReturnType<typeof db.ledgerEntry.findMany>>[number];

function vnDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) };
}

function vnDayStart(year: number, month: number, day: number) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`);
}

function vnDayEnd(year: number, month: number, day: number) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59+07:00`);
}

function monthStart(year: number, month: number) {
  return vnDayStart(year, month, 1);
}

function parseInputDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = endOfDay ? vnDayEnd(year, month, day) : vnDayStart(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, amount: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + amount);
  return result;
}

function rangeBounds(range: RangeKey, profileStart: Date, url: URL) {
  const now = new Date();
  const today = vnDateParts(now);
  const todayStart = vnDayStart(today.year, today.month, today.day);
  let start = todayStart;
  let end = now;

  if (range === "week") {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: VN_TIME_ZONE, weekday: "short" }).format(now);
    const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
    const daysFromMonday = dayIndex === 0 ? 6 : Math.max(0, dayIndex - 1);
    start = new Date(todayStart.getTime() - daysFromMonday * 86_400_000);
  }
  if (range === "month") start = monthStart(today.year, today.month);
  if (range === "quarter") start = monthStart(today.year, Math.floor((today.month - 1) / 3) * 3 + 1);
  if (range === "year") start = monthStart(today.year, 1);
  if (range === "custom") {
    start = parseInputDate(url.searchParams.get("from")) ?? monthStart(today.year, today.month);
    end = parseInputDate(url.searchParams.get("to"), true) ?? now;
    if (end > now) end = now;
    if (start > end) [start, end] = [end, start];
  }

  if (start < profileStart) start = profileStart;
  return { start, end, now, today };
}

function sum(entries: FinancialEntry[], category: "SERVICE_REVENUE" | "OPERATING_EXPENSE" | "REFUND") {
  return entries.filter((item) => item.category === category).reduce((total, item) => total + item.amount, 0);
}

function bucketMode(range: RangeKey, start: Date, end: Date) {
  const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  return range === "year" || range === "quarter" || days > 45 ? "month" as const : "day" as const;
}

function bucketKey(date: Date, mode: "day" | "month") {
  const { year, month, day } = vnDateParts(date);
  return mode === "month"
    ? `${year}-${String(month).padStart(2, "0")}`
    : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function bucketLabel(key: string, mode: "day" | "month") {
  const [year, month, day] = key.split("-");
  return mode === "month" ? `T${Number(month)}/${year.slice(-2)}` : `${day}/${month}`;
}

function buildSeries(entries: FinancialEntry[], start: Date, end: Date, mode: "day" | "month", profitSharePercent: number) {
  const buckets = new Map<string, { grossRevenue: number; refunds: number; expenses: number }>();
  if (mode === "day") {
    for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
      buckets.set(bucketKey(cursor, mode), { grossRevenue: 0, refunds: 0, expenses: 0 });
    }
  } else {
    const startParts = vnDateParts(start);
    const endParts = vnDateParts(end);
    let year = startParts.year;
    let month = startParts.month;
    while (year < endParts.year || (year === endParts.year && month <= endParts.month)) {
      buckets.set(`${year}-${String(month).padStart(2, "0")}`, { grossRevenue: 0, refunds: 0, expenses: 0 });
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }

  for (const entry of entries) {
    const key = bucketKey(entry.occurredAt, mode);
    const row = buckets.get(key) ?? { grossRevenue: 0, refunds: 0, expenses: 0 };
    if (entry.category === "SERVICE_REVENUE") row.grossRevenue += entry.amount;
    if (entry.category === "REFUND") row.refunds += entry.amount;
    if (entry.category === "OPERATING_EXPENSE") row.expenses += entry.amount;
    buckets.set(key, row);
  }

  const currentKey = bucketKey(new Date(), mode);
  return [...buckets.entries()].map(([key, item]) => {
    const revenue = item.grossRevenue - item.refunds;
    const profit = revenue - item.expenses;
    return {
      key,
      label: bucketLabel(key, mode),
      grossRevenue: item.grossRevenue,
      refunds: item.refunds,
      revenue,
      expenses: item.expenses,
      profit,
      marginPercent: revenue > 0 ? profit / revenue * 100 : 0,
      investorShare: Math.max(0, Math.round(profit * profitSharePercent / 100)),
      partial: key === currentKey,
    };
  });
}

function groupedDescriptions(entries: FinancialEntry[], category: "SERVICE_REVENUE" | "OPERATING_EXPENSE" | "REFUND") {
  const grouped = new Map<string, number>();
  for (const entry of entries.filter((item) => item.category === category)) {
    grouped.set(entry.description, (grouped.get(entry.description) ?? 0) + entry.amount);
  }
  return [...grouped.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER", "INVESTOR"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem danh mục đầu tư." }, { status: 403 });

  const profile = await db.investorProfile.findFirst({
    where: session.role === "INVESTOR" ? { userId: session.id } : undefined,
    include: {
      user: { select: { name: true } },
      allocations: { include: { branch: true }, orderBy: { branchId: "asc" } },
      distributions: { orderBy: { periodEnd: "desc" } },
    },
  });
  if (!profile) return NextResponse.json({ error: "Chưa thiết lập hồ sơ đầu tư cho tài khoản này." }, { status: 404 });

  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range");
  const range: RangeKey = RANGE_VALUES.includes(requestedRange as RangeKey) ? requestedRange as RangeKey : "month";
  const requestedBranch = url.searchParams.get("branchId");
  const availableBranchIds = new Set(profile.allocations.map((item) => item.branchId));
  const selectedBranchId = requestedBranch && requestedBranch !== "all" && availableBranchIds.has(requestedBranch) ? requestedBranch : "all";
  const selectedAllocations = selectedBranchId === "all" ? profile.allocations : profile.allocations.filter((item) => item.branchId === selectedBranchId);
  const { start: periodStart, end: periodEnd, now, today } = rangeBounds(range, profile.startDate, url);
  const selectedBranchIds = selectedAllocations.map((item) => item.branchId);
  const allBranchIds = profile.allocations.map((item) => item.branchId);

  const [periodEntries, allEntries, opportunityRecords, benefitRecords] = await Promise.all([
    db.ledgerEntry.findMany({
      where: {
        ...ledgerReportWhere(),
        branchId: { in: selectedBranchIds },
        category: { in: ["SERVICE_REVENUE", "OPERATING_EXPENSE", "REFUND"] },
        occurredAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { occurredAt: "asc" },
    }),
    db.ledgerEntry.findMany({
      where: {
        ...ledgerReportWhere(),
        branchId: { in: allBranchIds },
        category: { in: ["SERVICE_REVENUE", "OPERATING_EXPENSE", "REFUND"] },
        occurredAt: { gte: profile.startDate, lte: now },
      },
      orderBy: { occurredAt: "asc" },
    }),
    db.investmentOpportunity.findMany({
      where: { isPublished: true },
      include: { checks: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ progressPercent: "desc" }, { updatedAt: "desc" }],
    }),
    db.investorBenefit.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const grossRevenue = sum(periodEntries, "SERVICE_REVENUE");
  const dataQuality = summarizeLedgerOrigins(periodEntries);
  const refunds = sum(periodEntries, "REFUND");
  const revenue = grossRevenue - refunds;
  const expenses = sum(periodEntries, "OPERATING_EXPENSE");
  const operatingProfit = revenue - expenses;
  const investorProfitShare = Math.max(0, Math.round(operatingProfit * profile.profitSharePercent / 100));
  const selectedCapital = selectedAllocations.reduce((total, item) => total + item.allocatedCapital, 0);
  const mode = bucketMode(range, periodStart, periodEnd);
  const series = buildSeries(periodEntries, periodStart, periodEnd, mode, profile.profitSharePercent);

  const historicalMap = new Map<string, { grossRevenue: number; refunds: number; expenses: number }>();
  for (const entry of allEntries) {
    const key = bucketKey(entry.occurredAt, "month");
    const row = historicalMap.get(key) ?? { grossRevenue: 0, refunds: 0, expenses: 0 };
    if (entry.category === "SERVICE_REVENUE") row.grossRevenue += entry.amount;
    if (entry.category === "REFUND") row.refunds += entry.amount;
    if (entry.category === "OPERATING_EXPENSE") row.expenses += entry.amount;
    historicalMap.set(key, row);
  }
  const currentMonthKey = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const historicalMonths = [...historicalMap.entries()].map(([key, item]) => {
    const revenue = item.grossRevenue - item.refunds;
    const profit = revenue - item.expenses;
    return {
      key,
      revenue,
      expenses: item.expenses,
      profit,
      investorShare: Math.max(0, Math.round(profit * profile.profitSharePercent / 100)),
      partial: key === currentMonthKey,
    };
  });
  const completedMonths = historicalMonths.filter((item) => !item.partial && item.profit > 0);
  const averageMonthlyShare = completedMonths.length
    ? Math.round(completedMonths.reduce((total, item) => total + item.investorShare, 0) / completedMonths.length)
    : Math.max(0, investorProfitShare);
  const recentMonths = completedMonths.slice(-3);
  const recentAverageShare = recentMonths.length
    ? Math.round(recentMonths.reduce((total, item) => total + item.investorShare, 0) / recentMonths.length)
    : averageMonthlyShare;
  const aiMonthlyShareEstimate = Math.round(averageMonthlyShare * 0.4 + recentAverageShare * 0.6);

  const paidDistributions = profile.distributions.filter((item) => item.status === "PAID");
  const paidReturns = paidDistributions.reduce((total, item) => total + item.amount, 0);
  const pendingReturns = profile.distributions.filter((item) => item.status === "PENDING").reduce((total, item) => total + item.amount, 0);
  const recoveredPercent = profile.investedAmount > 0 ? paidReturns / profile.investedAmount * 100 : 0;
  const remainingCapital = Math.max(0, profile.investedAmount - paidReturns);
  const projectedRemainingMonths = aiMonthlyShareEstimate > 0 ? Math.ceil(remainingCapital / aiMonthlyShareEstimate) : null;
  const optimisticMonths = projectedRemainingMonths === null ? null : Math.max(1, Math.floor(projectedRemainingMonths * 0.9));
  const conservativeMonths = projectedRemainingMonths === null ? null : Math.ceil(projectedRemainingMonths * 1.1);
  const projectedPaybackDate = projectedRemainingMonths === null ? null : addMonths(now, projectedRemainingMonths).toISOString();

  const branches = selectedAllocations.map((allocation) => {
    const scopedEntries = periodEntries.filter((item) => item.branchId === allocation.branchId);
    const branchGrossRevenue = sum(scopedEntries, "SERVICE_REVENUE");
    const branchRefunds = sum(scopedEntries, "REFUND");
    const branchRevenue = branchGrossRevenue - branchRefunds;
    const branchExpenses = sum(scopedEntries, "OPERATING_EXPENSE");
    const profit = branchRevenue - branchExpenses;
    return {
      branchId: allocation.branchId,
      label: allocation.branch.name.replace(/^Tâm An Center · /, ""),
      allocatedCapital: allocation.allocatedCapital,
      ownershipPercent: allocation.ownershipPercent,
      grossRevenue: branchGrossRevenue,
      refunds: branchRefunds,
      revenue: branchRevenue,
      expenses: branchExpenses,
      profit,
      investorShare: Math.max(0, Math.round(profit * profile.profitSharePercent / 100)),
      marginPercent: branchRevenue > 0 ? profit / branchRevenue * 100 : 0,
      revenueContributionPercent: revenue > 0 ? branchRevenue / revenue * 100 : 0,
      expenseRatioPercent: branchRevenue > 0 ? branchExpenses / branchRevenue * 100 : 0,
      series: buildSeries(scopedEntries, periodStart, periodEnd, mode, profile.profitSharePercent),
      revenueSources: groupedDescriptions(scopedEntries, "SERVICE_REVENUE"),
      refundSources: groupedDescriptions(scopedEntries, "REFUND"),
      expenseSources: groupedDescriptions(scopedEntries, "OPERATING_EXPENSE"),
    };
  });

  const opportunities = opportunityRecords.map((item) => ({
    id: item.id,
    type: item.type,
    name: item.name,
    area: item.area,
    status: item.status,
    statusLabel: item.statusLabel,
    portfolioRelation: "OUTSIDE_ACTIVE_PORTFOLIO" as const,
    portfolioRelationLabel: "Chưa thuộc danh mục hiện tại",
    progressPercent: item.progressPercent,
    capitalNeed: Number(item.capitalNeed),
    expressedInterestCapital: Number(item.expressedInterestCapital),
    minimumCommitment: Number(item.minimumCommitment),
    targetReturnRange: item.targetReturnRange,
    expectedPaybackPeriod: item.expectedPaybackPeriod,
    expectedOpening: item.expectedOpening,
    nextUpdate: item.nextUpdate,
    aiAssessment: item.aiAssessment,
    highlights: item.highlights,
    checks: item.checks.map((check) => ({ label: check.label, status: check.status })),
  }));

  const benefits = benefitRecords.map((item) => ({ id: item.id, title: item.title, detail: item.detail, badge: item.badge }));

  const remainingOpportunityCapital = opportunities.reduce((total, item) => total + item.capitalNeed - item.expressedInterestCapital, 0);

  return NextResponse.json({
    profile: {
      displayName: profile.user.name,
      investedAmount: profile.investedAmount,
      ownershipPercent: profile.ownershipPercent,
      profitSharePercent: profile.profitSharePercent,
      targetAnnualReturn: profile.targetAnnualReturn,
      startDate: profile.startDate.toISOString(),
      note: profile.note,
    },
    filters: {
      range,
      branchId: selectedBranchId,
      availableBranches: profile.allocations.map((item) => ({
        branchId: item.branchId,
        label: item.branch.name.replace(/^Tâm An Center · /, ""),
        allocatedCapital: item.allocatedCapital,
      })),
    },
    period: { range, start: periodStart.toISOString(), end: periodEnd.toISOString(), bucket: mode },
    summary: {
      selectedCapital,
      grossRevenue,
      refunds,
      revenue,
      expenses,
      operatingProfit,
      operatingMarginPercent: revenue > 0 ? operatingProfit / revenue * 100 : 0,
      investorProfitShare,
      paidReturns,
      pendingReturns,
      recoveredPercent,
      remainingCapital,
      averageMonthlyShare,
      projectedRemainingMonths,
      projectedPaybackDate,
      targetAnnualReturnAmount: Math.round(profile.investedAmount * profile.targetAnnualReturn / 100),
      aiPaybackEstimate: {
        monthlyProfitShare: aiMonthlyShareEstimate,
        baseMonths: projectedRemainingMonths,
        optimisticMonths,
        conservativeMonths,
        baseDate: projectedPaybackDate,
        earliestDate: optimisticMonths === null ? null : addMonths(now, optimisticMonths).toISOString(),
        latestDate: conservativeMonths === null ? null : addMonths(now, conservativeMonths).toISOString(),
        variancePercent: 10,
        confidencePercent: Math.min(88, 62 + completedMonths.length * 4),
        trendPercent: averageMonthlyShare > 0 ? (recentAverageShare - averageMonthlyShare) / averageMonthlyShare * 100 : 0,
      },
    },
    branches,
    series,
    distributions: profile.distributions.map((item) => ({
      id: item.id,
      periodStart: item.periodStart.toISOString(),
      periodEnd: item.periodEnd.toISOString(),
      amount: item.amount,
      status: item.status,
      paidAt: item.paidAt?.toISOString() ?? null,
      note: item.note,
    })),
    briefing: {
      headline: recentAverageShare >= averageMonthlyShare ? "Danh mục đang đi đúng tiến độ hoàn vốn" : "Danh mục cần theo dõi thêm biên lợi nhuận",
      detail: `Tiến độ ba tháng gần nhất ${averageMonthlyShare > 0 ? `${recentAverageShare >= averageMonthlyShare ? "+" : ""}${((recentAverageShare - averageMonthlyShare) / averageMonthlyShare * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "đang cập nhật"} so với bình quân dài hạn.`,
      activePortfolioBranches: profile.allocations.length,
      pipelineOpportunities: opportunities.length,
      remainingOpportunityCapital,
      nextMilestone: "Cập nhật khảo sát cơ hội Đống Đa · 24/07/2026",
    },
    opportunities,
    benefits,
    dataPolicy: {
      scope: "Tài chính tổng hợp theo cơ sở đã đầu tư",
      excludes: ["Thông tin định danh khách hàng", "Bill chi tiết", "Tip KTV ngoài bill", "Dữ liệu nhân sự cá nhân"],
      projection: "AI ước tính hoàn vốn theo 40% bình quân dài hạn và 60% tiến độ ba tháng gần nhất, kèm biên thời gian ±10%; không phải cam kết lợi nhuận.",
      sourceStatus: dataQuality,
    },
  });
}
