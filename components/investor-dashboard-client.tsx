"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgePercent,
  Building2,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileSearch,
  Gem,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Newspaper,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "week" | "month" | "quarter" | "year" | "custom";
type InvestorView = "overview" | "performance" | "opportunities" | "benefits" | "updates";

type SeriesPoint = {
  key: string;
  label: string;
  revenue: number;
  grossRevenue: number;
  refunds: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  investorShare: number;
  partial: boolean;
};

type BranchDetail = {
  branchId: string;
  label: string;
  allocatedCapital: number;
  ownershipPercent: number;
  grossRevenue: number;
  refunds: number;
  revenue: number;
  expenses: number;
  profit: number;
  investorShare: number;
  marginPercent: number;
  revenueContributionPercent: number;
  expenseRatioPercent: number;
  series: SeriesPoint[];
  revenueSources: Array<{ label: string; amount: number }>;
  refundSources: Array<{ label: string; amount: number }>;
  expenseSources: Array<{ label: string; amount: number }>;
};

type InvestorData = {
  profile: {
    displayName: string;
    investedAmount: number;
    ownershipPercent: number;
    profitSharePercent: number;
    targetAnnualReturn: number;
    startDate: string;
    note: string | null;
  };
  filters: {
    range: RangeKey;
    branchId: string;
    availableBranches: Array<{ branchId: string; label: string; allocatedCapital: number }>;
  };
  period: { range: RangeKey; start: string; end: string; bucket: "day" | "month" };
  summary: {
    selectedCapital: number;
    grossRevenue: number;
    refunds: number;
    revenue: number;
    expenses: number;
    operatingProfit: number;
    operatingMarginPercent: number;
    investorProfitShare: number;
    paidReturns: number;
    pendingReturns: number;
    recoveredPercent: number;
    remainingCapital: number;
    averageMonthlyShare: number;
    projectedRemainingMonths: number | null;
    projectedPaybackDate: string | null;
    targetAnnualReturnAmount: number;
    aiPaybackEstimate: {
      monthlyProfitShare: number;
      baseMonths: number | null;
      optimisticMonths: number | null;
      conservativeMonths: number | null;
      baseDate: string | null;
      earliestDate: string | null;
      latestDate: string | null;
      variancePercent: number;
      confidencePercent: number;
      trendPercent: number;
    };
  };
  branches: BranchDetail[];
  series: SeriesPoint[];
  distributions: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    status: "PENDING" | "PAID";
    paidAt: string | null;
    note: string | null;
  }>;
  briefing: {
    headline: string;
    detail: string;
    activePortfolioBranches: number;
    pipelineOpportunities: number;
    remainingOpportunityCapital: number;
    nextMilestone: string;
  };
  opportunities: Array<{
    id: string;
    type: "NEW_BRANCH" | "ACQUISITION";
    name: string;
    area: string;
    status: "SURVEYING" | "DUE_DILIGENCE" | "FUNDING" | "APPROVED" | "ON_HOLD" | "CLOSED";
    statusLabel: string;
    portfolioRelation: "OUTSIDE_ACTIVE_PORTFOLIO";
    portfolioRelationLabel: string;
    progressPercent: number;
    capitalNeed: number;
    expressedInterestCapital: number;
    minimumCommitment: number;
    targetReturnRange: string;
    expectedPaybackPeriod: string;
    expectedOpening: string;
    nextUpdate: string;
    aiAssessment: string;
    highlights: string[];
    checks: Array<{ label: string; status: "DONE" | "IN_PROGRESS" | "PENDING" }>;
  }>;
  benefits: Array<{ id: string; title: string; detail: string; badge: string }>;
  dataPolicy: {
    scope: string;
    excludes: string[];
    projection: string;
    sourceStatus: {
      reportingMode: "UAT_WITH_DEMO" | "PRODUCTION_LIVE_ONLY";
      includesDemoData: boolean;
      origins: Record<"LIVE" | "IMPORTED" | "DEMO", { count: number; amount: number }>;
    };
  };
};

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
  { key: "custom", label: "Tùy chỉnh" },
];

const investorViews: Array<{ key: InvestorView; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { key: "performance", label: "Hiệu quả", icon: ChartNoAxesCombined },
  { key: "opportunities", label: "Cơ hội mới", icon: Rocket },
  { key: "benefits", label: "Đặc quyền", icon: Gem },
  { key: "updates", label: "Cập nhật", icon: Newspaper },
];

const investorViewPresentation: Record<InvestorView, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  pageClass: string;
  glowClass: string;
  heroClass: string;
  activeTabClass: string;
}> = {
  overview: {
    eyebrow: "Tài sản đã đầu tư",
    title: "Danh mục đang vận hành",
    description: "Cơ sở 1 và Cơ sở 2 đã được giải ngân, đang tạo doanh thu và được tính trong báo cáo hiện tại.",
    icon: Landmark,
    pageClass: "bg-[#160f0e]",
    glowClass: "bg-[radial-gradient(circle_at_85%_0%,rgba(232,198,101,0.18),transparent_30%),radial-gradient(circle_at_5%_35%,rgba(132,36,37,0.22),transparent_30%)]",
    heroClass: "border-[#e8c665]/25 from-[#4a2d20] via-[#281817] to-[#130d0c]",
    activeTabClass: "bg-[#e8c665] text-[#2b1b13]",
  },
  performance: {
    eyebrow: "Số liệu cơ sở hoạt động",
    title: "Hiệu quả tài chính",
    description: "Đối chiếu doanh thu, chi phí và lợi nhuận riêng của các cơ sở đã nằm trong danh mục đầu tư.",
    icon: ChartNoAxesCombined,
    pageClass: "bg-[#0d1715]",
    glowClass: "bg-[radial-gradient(circle_at_80%_0%,rgba(78,190,151,0.18),transparent_31%),radial-gradient(circle_at_0%_38%,rgba(29,84,70,0.24),transparent_33%)]",
    heroClass: "border-emerald-300/20 from-[#17362f] via-[#13231f] to-[#0b1211]",
    activeTabClass: "bg-[#6bd2ae] text-[#10251f]",
  },
  opportunities: {
    eyebrow: "Pipeline mở rộng",
    title: "Cơ hội đầu tư mới",
    description: "Các địa điểm đang khảo sát hoặc thẩm định; chưa thuộc danh mục, chưa giải ngân và không cộng vào báo cáo Cơ sở 1–2.",
    icon: Rocket,
    pageClass: "bg-[#0e1420]",
    glowClass: "bg-[radial-gradient(circle_at_82%_0%,rgba(96,165,250,0.2),transparent_32%),radial-gradient(circle_at_0%_42%,rgba(36,78,127,0.26),transparent_34%)]",
    heroClass: "border-sky-300/22 from-[#1c3550] via-[#172537] to-[#0d131d]",
    activeTabClass: "bg-[#78baff] text-[#10243a]",
  },
  benefits: {
    eyebrow: "Investor Privilege",
    title: "Đặc quyền Nhà đầu tư",
    description: "Quyền lợi sức khỏe, tiếp đón đối tác và quyền tiếp cận hồ sơ sớm dành riêng cho nhà đầu tư hiện hữu.",
    icon: Gem,
    pageClass: "bg-[#180f1b]",
    glowClass: "bg-[radial-gradient(circle_at_82%_0%,rgba(210,140,223,0.2),transparent_32%),radial-gradient(circle_at_0%_42%,rgba(104,45,103,0.25),transparent_34%)]",
    heroClass: "border-fuchsia-300/20 from-[#492744] via-[#2a192d] to-[#150f18]",
    activeTabClass: "bg-[#d99be4] text-[#341b38]",
  },
  updates: {
    eyebrow: "Bản tin & phân phối",
    title: "Cập nhật danh mục",
    description: "Theo dõi thông tin điều hành, các mốc thẩm định và lịch sử phân phối lợi nhuận theo thời gian.",
    icon: Newspaper,
    pageClass: "bg-[#0f151d]",
    glowClass: "bg-[radial-gradient(circle_at_82%_0%,rgba(141,183,221,0.18),transparent_32%),radial-gradient(circle_at_0%_42%,rgba(47,70,94,0.28),transparent_34%)]",
    heroClass: "border-slate-300/18 from-[#29394a] via-[#1b2734] to-[#0f151d]",
    activeTabClass: "bg-[#9bc5e8] text-[#172838]",
  },
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value)) + "đ";
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
  return money(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function monthYear(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function inputDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function periodText(data: InvestorData) {
  const activeRange = ranges.find((item) => item.key === data.period.range)?.label ?? "Đang chọn";
  return `${activeRange} · ${shortDate(data.period.start)} – ${shortDate(data.period.end)}`;
}

function ModalShell({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Đóng" />
      <section className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] border border-[#e8c665]/20 bg-[#1c1312] p-4 text-white shadow-2xl sm:max-w-xl sm:rounded-[28px] sm:p-5">
        <div className="px-10 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#e8c665]">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/5 text-white/65" aria-label="Đóng"><X size={17} /></button>
        {children}
      </section>
    </div>
  );
}

export function InvestorDashboardClient() {
  const today = inputDate();
  const [range, setRange] = useState<RangeKey>("month");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 8)}01`);
  const [customTo, setCustomTo] = useState(today);
  const [data, setData] = useState<InvestorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<SeriesPoint | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchDetail | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<InvestorView>("overview");
  const [followedOpportunities, setFollowedOpportunities] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const syncView = () => {
      const requested = window.location.hash.replace(/^#+/, "").split("#")[0] as InvestorView;
      if (investorViews.some((item) => item.key === requested)) setActiveView(requested);
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ range, branchId: selectedBranchId });
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    fetch(`/api/investor/summary?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải báo cáo đầu tư.");
        return payload as InvestorData;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải báo cáo đầu tư."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customFrom, customTo, range, refreshKey, selectedBranchId]);

  const chartMax = useMemo(() => Math.max(1, ...(data?.series.flatMap((item) => [item.revenue, item.expenses, Math.max(0, item.profit)]) ?? [1])), [data]);

  function selectRange(nextRange: RangeKey) {
    if (nextRange === range) return;
    setLoading(true);
    setError("");
    setSelectedPoint(null);
    setRange(nextRange);
  }

  function selectBranch(branchId: string) {
    if (branchId === selectedBranchId) return;
    setLoading(true);
    setError("");
    setSelectedPoint(null);
    setSelectedBranch(null);
    setSelectedBranchId(branchId);
  }

  function refresh() {
    setLoading(true);
    setError("");
    setRefreshKey((value) => value + 1);
  }

  function selectView(view: InvestorView) {
    setActiveView(view);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${view}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  function toggleOpportunityFollow(id: string) {
    setFollowedOpportunities((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!data && loading) {
    return (
      <main className="min-h-screen bg-[#160f0e] px-4 py-10 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-16 text-sm text-white/70">
          <RefreshCw size={18} className="animate-spin text-[#e8c665]" /> Đang tổng hợp dữ liệu đầu tư…
        </div>
      </main>
    );
  }

  if (!data || error) {
    return (
      <main className="min-h-screen bg-[#160f0e] px-4 py-10 text-white">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-300/20 bg-red-500/10 p-6 text-center">
          <p className="font-semibold">Chưa thể mở Trung tâm Nhà đầu tư</p>
          <p className="mt-2 text-sm text-white/65">{error}</p>
          <button type="button" onClick={refresh} className="mt-4 rounded-full bg-[#e8c665] px-5 py-2 text-sm font-semibold text-[#281b13]">Thử tải lại</button>
        </div>
      </main>
    );
  }

  const { profile, summary } = data;
  const recoveryWidth = Math.min(100, Math.max(0, summary.recoveredPercent));
  const payback = summary.aiPaybackEstimate;
  const currentScope = selectedBranchId === "all" ? "Toàn bộ danh mục" : data.filters.availableBranches.find((item) => item.branchId === selectedBranchId)?.label ?? "Cơ sở đã chọn";
  const selectedOpportunity = data.opportunities.find((item) => item.id === selectedOpportunityId) ?? null;
  const viewPresentation = investorViewPresentation[activeView];
  const ViewIcon = viewPresentation.icon;

  return (
    <main className={cn("min-h-screen overflow-x-hidden pb-28 text-white transition-colors duration-500 sm:pb-12", viewPresentation.pageClass)}>
      <div className={cn("pointer-events-none fixed inset-0 transition-all duration-500", viewPresentation.glowClass)} />
      <div className="relative mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-4 sm:px-6 sm:py-7 lg:px-10">
        <nav className="sticky top-[65px] z-30 mx-0 hidden items-stretch justify-center gap-1 rounded-2xl border border-[#e8c665]/18 bg-[#160f0e]/95 p-1.5 shadow-xl shadow-black/20 backdrop-blur md:flex" aria-label="Điều hướng Trung tâm Nhà đầu tư">
          {investorViews.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} type="button" onClick={() => selectView(item.key)} className={cn("relative flex min-w-[78px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-semibold transition sm:max-w-36 sm:flex-row sm:text-[10px]", activeView === item.key ? `${investorViewPresentation[item.key].activeTabClass} shadow` : "text-white/48 hover:bg-white/5 hover:text-white")}><Icon size={14} /><span>{item.label}</span>{item.key === "opportunities" ? <i className={cn("absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] not-italic", activeView === item.key ? "bg-[#10243a] text-[#baddff]" : "bg-sky-500 text-white")}>{data.briefing.pipelineOpportunities}</i> : null}</button>;
          })}
        </nav>

        <section className={cn("mt-3 overflow-hidden rounded-[28px] border bg-gradient-to-br text-center shadow-2xl shadow-black/30 transition-all duration-500", viewPresentation.heroClass, activeView === "overview" || activeView === "performance" ? "p-4 sm:p-7" : "p-4 sm:p-5")}>
          <div className="mx-auto flex max-w-3xl flex-col items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white shadow-lg"><ViewIcon size={19} /></span>
            <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/52">{viewPresentation.eyebrow}</div>
            <h1 className={cn("mt-1 font-semibold tracking-tight", activeView === "overview" || activeView === "performance" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl")}>{viewPresentation.title}</h1>
            <p className="mt-2 max-w-2xl text-[10px] leading-5 text-white/58 sm:text-xs">{viewPresentation.description}</p>
            {data.dataPolicy.sourceStatus.includesDemoData ? <div className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-[9px] font-semibold leading-4 text-amber-100">Bản UAT đang hiển thị cả dữ liệu mẫu để trình diễn. Khi chuyển sang production, hệ thống tự loại toàn bộ số liệu DEMO khỏi báo cáo đầu tư.</div> : null}
            {activeView === "overview" ? <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/8 px-3 py-2 text-[10px] text-emerald-100/85"><ShieldCheck size={15} className="text-emerald-300" /> {data.briefing.activePortfolioBranches} cơ sở đã giải ngân · quyền chỉ xem</div> : null}
            {activeView === "opportunities" ? <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-sky-200/16 bg-sky-200/8 px-3 py-2 text-[9px] font-semibold text-sky-100"><LockKeyhole size={13} /> Tách biệt hoàn toàn với tài chính đang vận hành</div> : null}
            {activeView === "benefits" ? <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-fuchsia-200/16 bg-fuchsia-200/8 px-3 py-2 text-[9px] font-semibold text-fuchsia-100"><Gem size={13} /> {data.benefits.length} đặc quyền đang kích hoạt</div> : null}
            {activeView === "updates" ? <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-slate-200/16 bg-slate-200/8 px-3 py-2 text-[9px] font-semibold text-slate-100"><Newspaper size={13} /> Điều hành · hồ sơ mới · phân phối lợi nhuận</div> : null}
          </div>

          {activeView === "overview" || activeView === "performance" ? <div className="mt-5 border-t border-white/8 pt-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">Khoảng thời gian</p>
            <div className="mx-auto mt-2 grid max-w-2xl grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-1.5 lg:grid-cols-6">
              {ranges.map((item) => (
                <button key={item.key} type="button" onClick={() => selectRange(item.key)} className={cn("min-w-0 rounded-xl px-1.5 py-2 text-[10px] font-semibold transition sm:px-2 sm:text-xs", range === item.key ? "bg-[#e8c665] text-[#2b1b13] shadow" : "text-white/55 hover:text-white")}>{item.label}</button>
              ))}
            </div>

            {range === "custom" ? (
              <div className="mx-auto mt-2 grid max-w-md grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl border border-white/8 bg-black/15 p-2">
                <label className="text-left"><span className="ml-1 block text-[8px] text-white/38">Từ ngày</span><input type="date" value={customFrom} max={customTo} onChange={(event) => { setLoading(true); setCustomFrom(event.target.value); }} className="mt-1 w-full rounded-xl border border-white/10 bg-white/8 px-2 py-2 text-[10px] text-white [color-scheme:dark]" /></label>
                <label className="text-left"><span className="ml-1 block text-[8px] text-white/38">Đến ngày</span><input type="date" value={customTo} min={customFrom} max={today} onChange={(event) => { setLoading(true); setCustomTo(event.target.value); }} className="mt-1 w-full rounded-xl border border-white/10 bg-white/8 px-2 py-2 text-[10px] text-white [color-scheme:dark]" /></label>
                <button type="button" onClick={refresh} className="self-end rounded-xl bg-[#e8c665] px-3 py-2 text-[10px] font-bold text-[#2b1b13]">Lọc</button>
              </div>
            ) : null}

            <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">Phạm vi đầu tư</p>
            <div className="scrollbar-hide mx-auto mt-2 flex max-w-xl justify-center gap-1.5 overflow-x-auto">
              {[{ branchId: "all", label: "Tất cả cơ sở" }, ...data.filters.availableBranches].map((item) => (
                <button key={item.branchId} type="button" onClick={() => selectBranch(item.branchId)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold", selectedBranchId === item.branchId ? "border-[#e8c665] bg-[#e8c665]/15 text-[#f4d979]" : "border-white/10 text-white/48")}>{item.label}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-[9px] text-white/38"><span>{periodText(data)}</span><span>·</span><button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-1 text-[#e8c665]/75 disabled:opacity-50"><RefreshCw size={11} className={cn(loading && "animate-spin")} /> Cập nhật</button></div>
          </div> : null}
        </section>

        {activeView === "overview" ? <section className="mt-3 rounded-[24px] border border-[#e8c665]/16 bg-[#251816]/90 p-4 text-center sm:p-5">
          <div className="flex flex-col items-center"><Landmark size={19} className="text-[#e8c665]" /><p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#e8c665]">Danh mục hiện hữu</p><h2 className="mt-1 text-base font-semibold">{data.briefing.activePortfolioBranches} cơ sở đã đầu tư và đang hoạt động</h2><p className="mt-1 text-[9px] leading-4 text-white/38">Chỉ số tài chính bên dưới chỉ tổng hợp từ các cơ sở này.</p></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {data.branches.map((branch) => <button key={branch.branchId} type="button" onClick={() => setSelectedBranch(branch)} className="rounded-2xl border border-[#e8c665]/12 bg-black/15 p-3 text-center transition hover:border-[#e8c665]/30"><span className="inline-flex rounded-full bg-emerald-300/9 px-2 py-1 text-[8px] font-bold text-emerald-200">ĐANG VẬN HÀNH</span><p className="mt-2 text-sm font-semibold">{branch.label}</p><p className="mt-1 text-[9px] text-white/36">Đã phân bổ {compactMoney(branch.allocatedCapital)}</p><div className="mt-2 border-t border-white/7 pt-2"><p className="text-[8px] text-white/35">Lợi nhuận kỳ chọn</p><p className="mt-0.5 text-xs font-semibold text-[#f0d478]">{compactMoney(branch.profit)}</p></div></button>)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.035] px-3 py-2 text-[9px] text-white/40"><ShieldCheck size={12} className="text-emerald-300" /> Không bao gồm các địa điểm đang khảo sát trong tab Cơ hội mới.</div>
        </section> : null}

        {activeView === "overview" ? <section className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {[
            { label: "Vốn trong phạm vi", value: compactMoney(summary.selectedCapital), note: currentScope, icon: WalletCards, tone: "gold" },
            { label: "Doanh thu thuần", value: compactMoney(summary.revenue), note: `Sau hoàn ${compactMoney(summary.refunds)} · không Tip`, icon: ArrowUpRight, tone: "green" },
            { label: "Chi phí", value: compactMoney(summary.expenses), note: "Đã hạch toán", icon: ArrowDownRight, tone: "red" },
            { label: "Lợi nhuận vận hành", value: compactMoney(summary.operatingProfit), note: `Biên ${summary.operatingMarginPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`, icon: ChartNoAxesCombined, tone: "blue" },
            { label: "Phần lợi nhuận của bạn", value: compactMoney(summary.investorProfitShare), note: `${profile.profitSharePercent}% lợi nhuận`, icon: HandCoins, tone: "gold" },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className={cn("flex min-h-32 flex-col items-center justify-center rounded-2xl border bg-white/[0.055] p-3.5 text-center", index === 4 && "col-span-2 lg:col-span-1", card.tone === "gold" ? "border-[#e8c665]/20" : "border-white/8")}>
                <Icon size={17} className={card.tone === "gold" ? "text-[#e8c665]" : card.tone === "green" ? "text-emerald-300" : card.tone === "red" ? "text-rose-300" : "text-sky-300"} />
                <p className="mt-2 text-[10px] font-medium text-white/48">{card.label}</p>
                <p className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">{card.value}</p>
                <p className="mt-1 text-[9px] text-white/35">{card.note}</p>
              </article>
            );
          })}
        </section> : null}

        {activeView === "overview" || activeView === "performance" ? <div className="mt-3 min-w-0">
          {activeView === "overview" ? <section className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.045] p-4 text-center sm:p-5">
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e8c665]">Tiến độ thu hồi vốn</p>
              <h2 className="mt-1 text-lg font-semibold">Đã nhận {compactMoney(summary.paidReturns)}</h2>
              <span className="mt-2 rounded-full border border-[#e8c665]/20 bg-[#e8c665]/8 px-2.5 py-1 text-[10px] font-semibold text-[#f3d982]">{summary.recoveredPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% vốn</span>
            </div>
            <div className="mx-auto mt-5 h-3 max-w-xl overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-[#9f6d1d] via-[#e8c665] to-[#fff0aa] transition-all" style={{ width: `${recoveryWidth}%` }} /></div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[10px] text-white/42"><span>Còn lại {compactMoney(summary.remainingCapital)}</span><span>Bình quân {compactMoney(summary.averageMonthlyShare)}/tháng</span></div>
            <div className="mt-5 grid min-w-0 grid-cols-1 gap-2.5 lg:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-[#e8c665]/16 bg-[#e8c665]/[0.045] p-3 text-center">
                <Sparkles size={17} className="mx-auto text-[#e8c665]" />
                <p className="mt-2 text-[10px] text-white/42">AI dự kiến hoàn vốn</p>
                <p className="mt-1 text-xs font-semibold leading-5 sm:text-sm">
                  {payback.earliestDate && payback.latestDate ? <><span className="block">{monthYear(payback.earliestDate)}</span><span className="block text-[10px] font-medium text-white/55">đến {monthYear(payback.latestDate)}</span></> : "Chưa đủ dữ liệu"}
                </p>
                <p className="mt-1 text-[9px] text-[#e8c665]/70">{payback.optimisticMonths ?? "—"}–{payback.conservativeMonths ?? "—"} tháng · ±{payback.variancePercent}%</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/7 bg-black/15 p-3 text-center">
                <Target size={17} className="mx-auto text-emerald-300" />
                <p className="mt-2 text-[10px] text-white/42">Mục tiêu năm</p>
                <p className="mt-1 text-sm font-semibold">{profile.targetAnnualReturn}% · {compactMoney(summary.targetAnnualReturnAmount)}</p>
                <p className="mt-1 text-[9px] text-white/30">Độ tin cậy AI {payback.confidencePercent}%</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-white/35"><TrendingUp size={12} className={payback.trendPercent >= 0 ? "text-emerald-300" : "text-rose-300"} /> Tiến độ 3 tháng gần nhất {payback.trendPercent >= 0 ? "+" : ""}{payback.trendPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% so với bình quân.</div>
          </section> : null}

          {activeView === "performance" ? <section className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-emerald-300/14 bg-[#12231f]/85 p-4 text-center shadow-xl shadow-black/15 sm:p-5">
            <ChartNoAxesCombined size={21} className="mx-auto text-[#e8c665]" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e8c665]">Biểu đồ tài chính</p>
            <h2 className="mt-1 text-base font-semibold">Doanh thu · Chi phí · Lợi nhuận</h2>
            <p className="mt-1 text-[9px] text-white/35">Bấm vào từng cột để xem số liệu cụ thể</p>
            <div className="scrollbar-hide mt-5 flex h-48 w-full min-w-0 items-end gap-2 overflow-x-auto overscroll-x-contain pb-1">
              {data.series.map((item) => (
                <button key={item.key} type="button" onClick={() => setSelectedPoint(item)} className="group flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1 rounded-lg px-0.5 hover:bg-white/[0.035]">
                  <div className="flex h-[145px] w-full items-end justify-center gap-1">
                    <span className="w-[27%] min-w-2 rounded-t-md bg-gradient-to-t from-emerald-800 to-emerald-300 transition group-active:brightness-125" style={{ height: `${Math.max(4, item.revenue / chartMax * 100)}%` }} />
                    <span className="w-[27%] min-w-2 rounded-t-md bg-gradient-to-t from-rose-900 to-rose-300 transition group-active:brightness-125" style={{ height: `${Math.max(4, item.expenses / chartMax * 100)}%` }} />
                    <span className="w-[27%] min-w-2 rounded-t-md bg-gradient-to-t from-[#8f681d] to-[#f1d36e] transition group-active:brightness-125" style={{ height: `${Math.max(4, Math.max(0, item.profit) / chartMax * 100)}%` }} />
                  </div>
                  <span className="text-[8px] text-white/42">{item.label}{item.partial ? "*" : ""}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 border-t border-white/7 pt-3 text-[9px] text-white/42">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-emerald-400" /> Doanh thu</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-rose-400" /> Chi phí</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#e8c665]" /> Lợi nhuận</span>
              <span>* chưa chốt</span>
            </div>
          </section> : null}
        </div> : null}

        {activeView === "performance" ? <section className="mt-3 rounded-[24px] border border-emerald-300/14 bg-[#12231f]/85 p-4 text-center sm:p-5">
          <Building2 size={19} className="mx-auto text-emerald-300" />
          <h2 className="mt-2 text-base font-semibold">Đối chiếu Cơ sở đang vận hành</h2>
          <p className="mt-1 text-[9px] text-white/35">Chỉ gồm Cơ sở 1 và Cơ sở 2 đã được giải ngân · bấm Card để xem cấu thành</p>
          <div className="mt-4 grid gap-2.5 md:grid-cols-2">
            {data.branches.map((branch) => (
              <button key={branch.branchId} type="button" onClick={() => setSelectedBranch(branch)} className="group rounded-2xl border border-white/7 bg-black/15 p-3.5 text-center transition hover:border-[#e8c665]/25 hover:bg-[#e8c665]/[0.035]">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8c665]/10 text-[#e8c665]"><Building2 size={16} /></span>
                  <p className="mt-2 text-sm font-semibold">{branch.label}</p>
                  <p className="mt-0.5 text-[9px] text-white/36">Phân bổ {compactMoney(branch.allocatedCapital)} · sở hữu {branch.ownershipPercent}%</p>
                  <span className={cn("mt-2 rounded-full px-2 py-1 text-[9px] font-semibold", branch.profit >= 0 ? "bg-emerald-300/10 text-emerald-200" : "bg-rose-300/10 text-rose-200")}>Biên lợi nhuận {branch.marginPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/7 pt-3">
                  <div><p className="text-[8px] text-white/35">Doanh thu thuần</p><p className="mt-1 text-xs font-semibold">{compactMoney(branch.revenue)}</p></div>
                  <div><p className="text-[8px] text-white/35">Chi phí</p><p className="mt-1 text-xs font-semibold">{compactMoney(branch.expenses)}</p></div>
                  <div><p className="text-[8px] text-white/35">Lợi nhuận</p><p className="mt-1 text-xs font-semibold text-[#f0d478]">{compactMoney(branch.profit)}</p></div>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-semibold text-[#e8c665]/70">Xem chi tiết <ChevronRight size={11} className="transition group-hover:translate-x-0.5" /></span>
              </button>
            ))}
          </div>
        </section> : null}

        {activeView === "opportunities" ? <section className="mt-3 rounded-[24px] border border-sky-300/16 bg-[#111d2b]/90 p-4 shadow-xl shadow-black/15 sm:p-5">
          <div className="text-center">
            <Rocket size={21} className="mx-auto text-sky-300" />
            <h2 className="mt-2 text-lg font-semibold">Pipeline cơ hội mở rộng</h2>
            <p className="mx-auto mt-1 max-w-xl text-[10px] leading-5 text-white/46">Đây là địa điểm tiềm năng hoàn toàn mới. Nhà đầu tư mới chỉ đăng ký quan tâm; chưa phát sinh góp vốn, quyền sở hữu, doanh thu hay lợi nhuận.</p>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-sky-300/14 bg-sky-300/[0.055] p-3 text-left"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-sky-300" /><div><p className="text-[10px] font-semibold text-sky-100">Không phải Cơ sở đang hoạt động</p><p className="mt-0.5 text-[9px] leading-4 text-white/42">Cơ sở 1 và Cơ sở 2 nằm ở Tổng quan/Hiệu quả. Các hồ sơ dưới đây chỉ xuất hiện trong pipeline cho đến khi hoàn tất thẩm định và được duyệt đầu tư.</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-sky-300/10 bg-black/15 p-3"><p className="text-[9px] text-white/38">Hồ sơ pipeline</p><p className="mt-1 text-lg font-semibold text-sky-200">{data.briefing.pipelineOpportunities}</p></div>
            <div className="rounded-2xl border border-sky-300/10 bg-black/15 p-3"><p className="text-[9px] text-white/38">Vốn dự kiến còn mở</p><p className="mt-1 text-sm font-semibold text-sky-200">{compactMoney(data.briefing.remainingOpportunityCapital)}</p></div>
            <div className="rounded-2xl border border-sky-300/10 bg-black/15 p-3"><p className="text-[9px] text-white/38">Đã hạch toán</p><p className="mt-1 text-sm font-semibold text-white">0đ</p></div>
          </div>
          <div className="scrollbar-hide mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible">
            {data.opportunities.map((item) => {
              const followed = followedOpportunities.has(item.id);
              const remaining = Math.max(0, item.capitalNeed - item.expressedInterestCapital);
              return <article key={item.id} className="min-w-[88%] snap-center overflow-hidden rounded-[22px] border border-sky-300/12 bg-[#0c1622] sm:min-w-[72%] lg:min-w-0">
                <div className="bg-gradient-to-br from-[#23415e] to-[#101c2a] p-4 text-center">
                  <div className="flex items-start justify-between gap-2 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e8c665]/20 bg-[#e8c665]/10 text-[#e8c665]">{item.type === "NEW_BRANCH" ? <Building2 size={18} /> : <FileSearch size={18} />}</span><span className="rounded-full border border-amber-300/18 bg-amber-300/8 px-2.5 py-1 text-[9px] font-semibold text-amber-100">{item.statusLabel} · {item.progressPercent}%</span></div>
                  <span className="mt-3 inline-flex rounded-full border border-sky-200/14 bg-sky-200/8 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-sky-100">{item.portfolioRelationLabel}</span>
                  <h3 className="mt-3 text-base font-semibold">{item.name}</h3>
                  <p className="mt-1 text-[10px] text-white/42">{item.area}</p>
                  <div className="mx-auto mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-[#a97720] to-[#f1d36e]" style={{ width: `${item.progressPercent}%` }} /></div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-white/[0.035] p-2.5"><p className="text-[8px] text-white/35">Tổng nhu cầu vốn</p><p className="mt-1 text-sm font-semibold">{compactMoney(item.capitalNeed)}</p></div>
                    <div className="rounded-xl bg-white/[0.035] p-2.5"><p className="text-[8px] text-white/35">Còn đang xem xét</p><p className="mt-1 text-sm font-semibold text-[#f0d478]">{compactMoney(remaining)}</p></div>
                    <div className="rounded-xl bg-white/[0.035] p-2.5"><p className="text-[8px] text-white/35">Mức tham gia dự kiến</p><p className="mt-1 text-xs font-semibold">Từ {compactMoney(item.minimumCommitment)}</p></div>
                    <div className="rounded-xl bg-white/[0.035] p-2.5"><p className="text-[8px] text-white/35">Mục tiêu tham chiếu</p><p className="mt-1 text-xs font-semibold">{item.targetReturnRange}</p></div>
                    <div className="col-span-2 rounded-xl border border-[#e8c665]/12 bg-[#e8c665]/[0.04] p-2.5"><p className="text-[8px] text-white/35">Thời gian hồi vốn dự kiến</p><p className="mt-1 text-xs font-semibold text-[#f0d478]">{item.expectedPaybackPeriod}</p></div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-sky-300/12 bg-sky-300/[0.04] p-3 text-center"><Sparkles size={15} className="mx-auto text-sky-300" /><p className="mt-1 text-[9px] font-semibold text-sky-200">Tóm tắt thẩm định</p><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-white/45">{item.aiAssessment}</p></div>
                  <p className="mt-3 text-center text-[9px] text-white/35">{item.nextUpdate} · {item.expectedOpening}</p>
                  <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2"><button type="button" onClick={() => setSelectedOpportunityId(item.id)} className="rounded-full border border-sky-300/30 px-3 py-2.5 text-[10px] font-bold text-sky-200">Xem hồ sơ</button><button type="button" onClick={() => toggleOpportunityFollow(item.id)} className={cn("rounded-full border px-3 py-2.5 text-[10px] font-bold", followed ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-sky-300 bg-sky-300 text-[#10243a]")}>{followed ? "Đang nhận cập nhật" : "Theo dõi cập nhật"}</button></div>
                </div>
              </article>;
            })}
            {data.opportunities.length === 0 ? <div className="col-span-full min-w-full rounded-2xl border border-dashed border-sky-300/18 bg-sky-300/[0.035] p-8 text-center text-[10px] leading-5 text-white/45">Chưa có hồ sơ cơ hội nào được Chủ Tâm An công bố. Nhà đầu tư sẽ nhận thông báo ngay khi một hồ sơ đủ điều kiện xuất hiện.</div> : null}
          </div>
        </section> : null}

        {activeView === "benefits" ? <section className="mt-3 rounded-[24px] border border-fuchsia-300/16 bg-[#28172b]/88 p-4 text-center shadow-xl shadow-black/15 sm:p-5">
          <Gem size={22} className="mx-auto text-fuchsia-200" />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">Tâm An Investor Privilege</p>
          <h2 className="mt-1 text-lg font-semibold">Đặc quyền rất riêng dành cho Nhà đầu tư</h2>
          <p className="mx-auto mt-1 max-w-xl text-[10px] leading-5 text-white/42">Quyền lợi sức khỏe, tiếp đón đối tác và quyền tiếp cận cơ hội sớm; tách biệt hoàn toàn với lợi nhuận tài chính.</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {data.benefits.map((benefit, index) => <article key={benefit.id} className="rounded-2xl border border-fuchsia-200/10 bg-gradient-to-br from-fuchsia-200/[0.075] to-transparent p-4 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-200/10 text-fuchsia-200">{index === 0 ? <Sparkles size={18} /> : index === 1 ? <Landmark size={18} /> : index === 2 ? <Rocket size={18} /> : <BadgePercent size={18} />}</span><span className="mt-3 inline-flex rounded-full bg-white/6 px-2 py-1 text-[8px] font-semibold text-fuchsia-100">{benefit.badge}</span><h3 className="mt-2 text-sm font-semibold">{benefit.title}</h3><p className="mt-1 text-[10px] leading-5 text-white/45">{benefit.detail}</p><p className="mt-3 text-[9px] font-semibold text-emerald-200">Đã kích hoạt theo hồ sơ đầu tư</p></article>)}
            {data.benefits.length === 0 ? <div className="sm:col-span-2 rounded-2xl border border-dashed border-fuchsia-200/16 p-8 text-[10px] leading-5 text-white/45">Đặc quyền đang được Admin Tâm An thiết lập theo hồ sơ đầu tư.</div> : null}
          </div>
          <div className="mt-3 rounded-2xl border border-fuchsia-200/14 bg-fuchsia-200/[0.055] p-4"><p className="text-xs font-semibold text-fuchsia-100">Đầu mối Nhà đầu tư</p><p className="mt-1 text-[10px] leading-5 text-white/48">Mọi lịch chăm sóc đặc quyền và tiếp đón đối tác sẽ được đội ngũ Investor Care xác nhận riêng, không làm ảnh hưởng quyền riêng tư tài chính.</p></div>
        </section> : null}

        {activeView === "updates" ? <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.75fr]">
          <section className="rounded-[24px] border border-slate-300/14 bg-gradient-to-br from-[#29394a]/88 to-[#151e28] p-4 text-center shadow-xl shadow-black/15 lg:col-span-2 sm:p-5">
            <Newspaper size={19} className="mx-auto text-sky-200" />
            <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-200">Bản tin điều hành</p>
            <h2 className="mt-1 text-base font-semibold">{data.briefing.headline}</h2>
            <p className="mx-auto mt-1 max-w-2xl text-[10px] leading-5 text-white/46">{data.briefing.detail}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Cơ sở đang hoạt động</p><p className="mt-1 text-sm font-semibold">{data.briefing.activePortfolioBranches}</p></div>
              <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Vốn còn xem xét</p><p className="mt-1 text-sm font-semibold text-[#f0d478]">{compactMoney(data.briefing.remainingOpportunityCapital)}</p></div>
              <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Mốc gần nhất</p><p className="mt-1 text-[10px] font-semibold leading-4">{data.briefing.nextMilestone}</p></div>
              <button type="button" onClick={() => selectView("opportunities")} className="rounded-2xl border border-sky-200/18 bg-sky-200/10 p-3 text-sky-100"><Rocket size={15} className="mx-auto" /><span className="mt-1 block text-[10px] font-semibold">{data.briefing.pipelineOpportunities} cơ hội mới</span></button>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">{data.opportunities.map((item) => <span key={item.id} className="rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1.5 text-[9px] text-white/50">{item.name} · <strong className="text-white/75">{item.statusLabel} {item.progressPercent}%</strong> · {item.nextUpdate}</span>)}</div>
          </section>
          <section className="rounded-[24px] border border-white/8 bg-white/[0.045] p-4 text-center sm:p-5">
            <CircleDollarSign size={19} className="mx-auto text-[#e8c665]" />
            <h2 className="mt-2 text-base font-semibold">Lịch sử phân phối lợi nhuận</h2>
            <div className="mt-3 space-y-2">
              {data.distributions.slice(0, 6).map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-white/6 bg-black/12 px-3 py-2.5 text-left">
                  <div><p className="text-xs font-semibold">Kỳ {monthYear(item.periodEnd)}</p><p className="mt-0.5 text-[9px] text-white/35">{item.status === "PAID" && item.paidAt ? `Đã trả ngày ${shortDate(item.paidAt)}` : "Chờ chốt sổ"}</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-[#f0d478]">+{money(item.amount)}</p><p className={cn("text-[8px] font-semibold", item.status === "PAID" ? "text-emerald-300" : "text-amber-300")}>{item.status === "PAID" ? "ĐÃ PHÂN PHỐI" : "DỰ KIẾN"}</p></div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[24px] border border-[#e8c665]/14 bg-[#e8c665]/[0.045] p-4 text-center sm:p-5">
            <LockKeyhole size={18} className="mx-auto text-[#e8c665]" />
            <h2 className="mt-2 text-sm font-semibold">Phạm vi dữ liệu an toàn</h2>
            <p className="mt-3 text-[10px] leading-5 text-white/48">{data.dataPolicy.scope}. Báo cáo này không hiển thị:</p>
            <ul className="mx-auto mt-2 max-w-xs space-y-1.5 text-[10px] text-white/55">{data.dataPolicy.excludes.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-4 border-t border-white/8 pt-3 text-[9px] italic leading-4 text-white/35">{data.dataPolicy.projection}</p>
            {profile.note ? <p className="mt-2 text-[9px] leading-4 text-white/30">{profile.note}</p> : null}
          </aside>
        </div> : null}
      </div>

      {selectedPoint ? (
        <ModalShell title={`Chi tiết ${selectedPoint.label}`} eyebrow={`${currentScope} · ${periodText(data)}`} onClose={() => setSelectedPoint(null)}>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] p-3"><ArrowUpRight size={16} className="mx-auto text-emerald-300" /><p className="mt-2 text-[9px] text-white/42">Doanh thu</p><p className="mt-1 text-sm font-semibold">{compactMoney(selectedPoint.revenue)}</p></div>
            <div className="rounded-2xl border border-rose-300/12 bg-rose-300/[0.045] p-3"><ArrowDownRight size={16} className="mx-auto text-rose-300" /><p className="mt-2 text-[9px] text-white/42">Chi phí</p><p className="mt-1 text-sm font-semibold">{compactMoney(selectedPoint.expenses)}</p></div>
            <div className="rounded-2xl border border-[#e8c665]/15 bg-[#e8c665]/[0.045] p-3"><TrendingUp size={16} className="mx-auto text-[#e8c665]" /><p className="mt-2 text-[9px] text-white/42">Lợi nhuận</p><p className="mt-1 text-sm font-semibold text-[#f0d478]">{compactMoney(selectedPoint.profit)}</p></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[9px] text-white/38">Biên lợi nhuận</p><p className="mt-1 text-base font-semibold">{selectedPoint.marginPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</p></div>
            <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[9px] text-white/38">Phần của bạn</p><p className="mt-1 text-base font-semibold text-[#f0d478]">{compactMoney(selectedPoint.investorShare)}</p></div>
          </div>
          <p className="mt-4 text-center text-[9px] italic leading-4 text-white/35">Tip KTV được loại khỏi toàn bộ doanh thu, chi phí và lợi nhuận trong báo cáo này.</p>
        </ModalShell>
      ) : null}

      {selectedOpportunity ? (
        <ModalShell title={selectedOpportunity.name} eyebrow={`Cơ hội mới · ${selectedOpportunity.statusLabel} · ${selectedOpportunity.progressPercent}%`} onClose={() => setSelectedOpportunityId(null)}>
          <div className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-2xl border border-sky-300/14 bg-sky-300/[0.055] p-3 text-left"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-sky-300" /><p className="text-[9px] leading-4 text-white/52"><strong className="text-sky-100">{selectedOpportunity.portfolioRelationLabel}.</strong> Hồ sơ này không được cộng vào vốn, doanh thu, chi phí hoặc lợi nhuận hiện tại.</p></div>
          <div className="mx-auto mt-5 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-[#a97720] to-[#f1d36e]" style={{ width: `${selectedOpportunity.progressPercent}%` }} /></div>
          <p className="mt-2 text-center text-[10px] text-white/42">{selectedOpportunity.area} · {selectedOpportunity.nextUpdate}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Nhu cầu vốn</p><p className="mt-1 text-sm font-semibold">{compactMoney(selectedOpportunity.capitalNeed)}</p></div>
            <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Đăng ký quan tâm</p><p className="mt-1 text-sm font-semibold">{compactMoney(selectedOpportunity.expressedInterestCapital)}</p></div>
            <div className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[8px] text-white/35">Mức dự kiến từ</p><p className="mt-1 text-sm font-semibold">{compactMoney(selectedOpportunity.minimumCommitment)}</p></div>
            <div className="rounded-2xl border border-[#e8c665]/14 bg-[#e8c665]/[0.04] p-3"><p className="text-[8px] text-white/35">Mục tiêu tham chiếu</p><p className="mt-1 text-sm font-semibold text-[#f0d478]">{selectedOpportunity.targetReturnRange}</p></div>
            <div className="col-span-2 rounded-2xl border border-sky-300/14 bg-sky-300/[0.04] p-3"><p className="text-[8px] text-white/35">Thời gian hồi vốn dự kiến</p><p className="mt-1 text-sm font-semibold text-sky-200">{selectedOpportunity.expectedPaybackPeriod}</p></div>
          </div>
          <div className="mt-3 rounded-2xl border border-[#e8c665]/12 bg-[#e8c665]/[0.04] p-3 text-center"><Sparkles size={16} className="mx-auto text-[#e8c665]" /><p className="mt-1 text-[9px] font-semibold text-[#f0d478]">Đánh giá hỗ trợ quyết định</p><p className="mt-1 text-[10px] leading-5 text-white/50">{selectedOpportunity.aiAssessment}</p></div>
          <div className="mt-3 space-y-1.5">{selectedOpportunity.highlights.map((highlight) => <p key={highlight} className="flex items-start gap-2 rounded-xl bg-white/[0.025] px-3 py-2 text-[10px] leading-4 text-white/52"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-300" />{highlight}</p>)}</div>
          <p className="mt-4 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Tiến độ hồ sơ</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">{selectedOpportunity.checks.map((check) => <span key={check.label} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-medium", check.status === "DONE" ? "border-emerald-300/15 bg-emerald-300/8 text-emerald-200" : check.status === "IN_PROGRESS" ? "border-amber-300/15 bg-amber-300/8 text-amber-100" : "border-white/8 text-white/35")}>{check.label}</span>)}</div>
          <p className="mt-4 text-center text-[9px] italic leading-4 text-white/32">Đăng ký quan tâm không phải cam kết vốn. Thông tin đang ở giai đoạn khảo sát/thẩm định, không phải cam kết lợi nhuận hoặc đề nghị chuyển tiền.</p>
        </ModalShell>
      ) : null}

      {selectedBranch ? (
        <ModalShell title={selectedBranch.label} eyebrow={`Chi tiết khoản đầu tư · ${periodText(data)}`} onClose={() => setSelectedBranch(null)}>
          <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              ["Vốn phân bổ", compactMoney(selectedBranch.allocatedCapital)],
              ["Doanh thu thuần", compactMoney(selectedBranch.revenue)],
              ["Chi phí", compactMoney(selectedBranch.expenses)],
              ["Lợi nhuận", compactMoney(selectedBranch.profit)],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/7 bg-black/15 p-3"><p className="text-[9px] text-white/38">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/7 p-3"><p className="text-[8px] text-white/35">Đóng góp doanh thu</p><p className="mt-1 text-sm font-semibold">{selectedBranch.revenueContributionPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</p></div>
            <div className="rounded-2xl border border-white/7 p-3"><p className="text-[8px] text-white/35">Tỷ lệ chi phí</p><p className="mt-1 text-sm font-semibold">{selectedBranch.expenseRatioPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</p></div>
            <div className="rounded-2xl border border-[#e8c665]/15 p-3"><p className="text-[8px] text-white/35">Phần của bạn</p><p className="mt-1 text-sm font-semibold text-[#f0d478]">{compactMoney(selectedBranch.investorShare)}</p></div>
          </div>
          {selectedBranch.refunds > 0 ? <div className="mt-3 rounded-2xl border border-amber-200/12 bg-amber-200/[0.045] p-3 text-center"><p className="text-[9px] text-white/42">Doanh thu gộp {compactMoney(selectedBranch.grossRevenue)} · đã hoàn khách {compactMoney(selectedBranch.refunds)}</p><p className="mt-1 text-[9px] leading-4 text-amber-100/65">Khoản hoàn đảo giảm doanh thu; không được xếp vào chi phí vận hành và không liên quan Tip KTV.</p></div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3 text-center">
              <p className="text-xs font-semibold text-emerald-200">Cấu thành doanh thu</p>
              <div className="mt-2 space-y-2">{selectedBranch.revenueSources.length ? selectedBranch.revenueSources.map((item) => <div key={item.label} className="rounded-xl bg-black/15 px-3 py-2"><p className="line-clamp-2 text-[9px] leading-4 text-white/45">{item.label}</p><p className="mt-0.5 text-xs font-semibold">{money(item.amount)}</p></div>) : <p className="py-4 text-[10px] text-white/35">Chưa có doanh thu trong kỳ.</p>}</div>
            </div>
            <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3 text-center">
              <p className="text-xs font-semibold text-rose-200">Cấu thành chi phí</p>
              <div className="mt-2 space-y-2">{selectedBranch.expenseSources.length ? selectedBranch.expenseSources.map((item) => <div key={item.label} className="rounded-xl bg-black/15 px-3 py-2"><p className="line-clamp-2 text-[9px] leading-4 text-white/45">{item.label}</p><p className="mt-0.5 text-xs font-semibold">{money(item.amount)}</p></div>) : <p className="py-4 text-[10px] text-white/35">Chưa có chi phí trong kỳ.</p>}</div>
            </div>
          </div>
          <button type="button" onClick={() => { setSelectedBranch(null); selectBranch(selectedBranch.branchId); }} className="mt-4 w-full rounded-full bg-[#e8c665] px-4 py-2.5 text-xs font-bold text-[#2b1b13]">Lọc toàn bộ báo cáo theo {selectedBranch.label}</button>
        </ModalShell>
      ) : null}
    </main>
  );
}
