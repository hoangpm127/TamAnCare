"use client";

import { useMemo, useState } from "react";
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { Briefcase, Building2, ChevronDown, PieChart, UserRound, Users } from "lucide-react";
import type { ReferralFriend, ReferralOrder, ReferralOrderCategory } from "@/lib/demo-data";
import { useReferralSummary } from "@/lib/referral-store";
import { useExpandToggle } from "@/lib/use-expand-toggle";
import { cn, formatMoney } from "@/lib/utils";

type OrderFilter = "all" | "confirmed" | "projected";
type RangePreset = "today" | "week" | "month" | "year" | "all" | "custom";

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "projected", label: "Dự kiến" },
];

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "today", label: "Hôm nay" },
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "year", label: "Năm nay" },
  { id: "custom", label: "Tùy chỉnh" },
];

const CATEGORY_META: Record<ReferralOrderCategory, { label: string; color: string; badge: string; icon: typeof UserRound }> = {
  INDIVIDUAL: { label: "Affiliate cá nhân", color: "#d13f1f", badge: "bg-[#fff2ef] text-[#d13f1f]", icon: UserRound },
  GROUP: { label: "Theo nhóm", color: "#b9862c", badge: "bg-[#fff7ec] text-[#8a5a12]", icon: Users },
  BUSINESS: { label: "Tâm An Business", color: "#1d6c40", badge: "bg-[#fff4e6] text-[#1d6c40]", icon: Briefcase },
};

function toIsoDateInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function IncomeSection({ detailed }: { detailed: boolean }) {
  const referral = useReferralSummary();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<ReferralOrderCategory | null>(null);
  const { isExpanded, toggle } = useExpandToggle(detailed);

  function toggleCategory(category: ReferralOrderCategory) {
    setCategoryFilter((prev) => (prev === category ? null : category));
  }

  const allOrders = useMemo(
    () => referral.invited.flatMap((friend) => friend.orders.map((order) => ({ ...order, friendName: friend.name }))),
    [referral.invited]
  );
  const dataMinDate = useMemo(
    () => allOrders.reduce((min, order) => (order.isoDate < min ? order.isoDate : min), allOrders[0]?.isoDate ?? toIsoDateInput(new Date())),
    [allOrders]
  );
  const dataMaxDate = useMemo(
    () => allOrders.reduce((max, order) => (order.isoDate > max ? order.isoDate : max), allOrders[0]?.isoDate ?? toIsoDateInput(new Date())),
    [allOrders]
  );

  const [rangePreset, setRangePreset] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState(dataMinDate);
  const [customTo, setCustomTo] = useState(dataMaxDate);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (rangePreset === "today") return { from: startOfDay(now), to: endOfDay(now) };
    if (rangePreset === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    if (rangePreset === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
    if (rangePreset === "year") return { from: startOfYear(now), to: endOfYear(now) };
    if (rangePreset === "custom") return { from: startOfDay(parseISO(customFrom)), to: endOfDay(parseISO(customTo)) };
    return { from: startOfDay(parseISO(dataMinDate)), to: endOfDay(parseISO(dataMaxDate)) };
  }, [rangePreset, customFrom, customTo, dataMinDate, dataMaxDate]);

  const ordersInRange = useMemo(
    () => allOrders.filter((order) => isWithinInterval(parseISO(order.isoDate), { start: from, end: to })),
    [allOrders, from, to]
  );

  const confirmedTotal = ordersInRange.filter((order) => order.status === "COMPLETED").reduce((sum, order) => sum + order.commission, 0);
  const projectedTotal = ordersInRange.filter((order) => order.status === "SCHEDULED").reduce((sum, order) => sum + order.commission, 0);

  const chartBars = useMemo(() => buildChartBars(ordersInRange, from, to), [ordersInRange, from, to]);
  const maxBar = Math.max(...chartBars.map((item) => item.amount), 1);

  const categoryTotals: Record<ReferralOrderCategory, number> = { INDIVIDUAL: 0, GROUP: 0, BUSINESS: 0 };
  for (const order of ordersInRange) {
    if (order.status === "COMPLETED") categoryTotals[order.category] += order.commission;
  }
  const donutTotal = categoryTotals.INDIVIDUAL + categoryTotals.GROUP + categoryTotals.BUSINESS;
  const donutSegments = buildDonutSegments(categoryTotals, donutTotal);

  const friendsWithMatchingOrders = referral.invited.filter((friend) =>
    friend.orders.some((order) => {
      if (!isWithinInterval(parseISO(order.isoDate), { start: from, end: to })) return false;
      if (categoryFilter && order.category !== categoryFilter) return false;
      if (filter === "confirmed") return order.status === "COMPLETED";
      if (filter === "projected") return order.status === "SCHEDULED";
      return true;
    })
  );

  return (
    <section className="mt-4 space-y-4">
      <div>
        <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {RANGE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRangePreset(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                rangePreset === item.id ? "border-[#d13f1f] bg-[#d13f1f] text-white" : "border-[#eadbd1] bg-white text-[#4d403a]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {rangePreset === "custom" ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#eadbd1] bg-white p-2.5">
            <label className="flex-1">
              <span className="block text-[10px] font-semibold text-[#8a7a72]">Từ ngày</span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[#eadbd1] px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[10px] font-semibold text-[#8a7a72]">Đến ngày</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[#eadbd1] px-2 py-1.5 text-xs"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-[#eadbd1] bg-white p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b86b1f]">Đã xác nhận</p>
          <p className="mt-1 text-lg font-bold text-[#b86b1f]">{formatMoney(confirmedTotal)}</p>
        </div>
        <div className="rounded-xl border border-dashed border-[#e3b23c] bg-[#fff7ec] p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a5a12]">Dự kiến</p>
          <p className="mt-1 text-lg font-bold text-[#8a5a12]">{formatMoney(projectedTotal)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#eadbd1] bg-white p-4">
        <p className="mb-3 text-sm font-semibold">Thu nhập theo {chartBars.granularityLabel}</p>
        {chartBars.length > 0 ? (
          <div className="scrollbar-hide flex items-end justify-between gap-1.5 overflow-x-auto">
            {chartBars.map((item) => (
              <div key={item.key} className="flex min-w-[28px] flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-[#b86b1f]"
                    style={{ height: `${Math.max(4, Math.round((item.amount / maxBar) * 100))}%` }}
                    title={formatMoney(item.amount)}
                  />
                </div>
                <p className="whitespace-nowrap text-[9px] text-[#8a7a72]">{item.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-[#8a7a72]">Không có thu nhập trong khoảng thời gian này.</p>
        )}
      </div>

      <div className="rounded-xl border border-[#eadbd1] bg-white p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <PieChart size={15} className="text-[#d13f1f]" /> Phân tích nguồn thu nhập
        </p>
        {donutTotal > 0 ? (
          <>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0 -rotate-90">
                <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f1e5dd" strokeWidth="6" />
                {donutSegments.map((seg) =>
                  seg.pct > 0 ? (
                    <circle
                      key={seg.key}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="6"
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.offset}
                      onClick={() => toggleCategory(seg.key)}
                      className={cn(
                        "cursor-pointer transition-opacity",
                        categoryFilter && categoryFilter !== seg.key ? "opacity-25" : "opacity-100"
                      )}
                    />
                  ) : null
                )}
              </svg>
              <div className="flex-1 space-y-1.5">
                {donutSegments.map((seg) => {
                  const Icon = CATEGORY_META[seg.key].icon;
                  const active = categoryFilter === seg.key;
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      onClick={() => toggleCategory(seg.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition",
                        active ? "bg-[#fdf8f5]" : "bg-transparent",
                        categoryFilter && !active ? "opacity-40" : "opacity-100"
                      )}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                      <Icon size={12} className="shrink-0 text-[#8a7a72]" />
                      <span className={cn("min-w-0 flex-1 truncate text-left text-[#4d403a]", active && "font-semibold text-[#191414]")}>
                        {CATEGORY_META[seg.key].label}
                      </span>
                      <span className="shrink-0 font-semibold text-[#191414]">{Math.round(seg.pct)}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-[#191414]">
              {categoryFilter ? CATEGORY_META[categoryFilter].label : "Tổng"}:{" "}
              <span className="text-[#d13f1f]">{formatMoney(categoryFilter ? categoryTotals[categoryFilter] : donutTotal)}</span>
            </p>
            {categoryFilter ? (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="mx-auto mt-1.5 block text-center text-[11px] font-semibold text-[#d13f1f] underline-offset-2 hover:underline"
              >
                Bỏ lọc, xem tất cả
              </button>
            ) : null}
          </>
        ) : (
          <p className="py-4 text-center text-xs text-[#8a7a72]">Không có dữ liệu trong khoảng thời gian này.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === item.id ? "border-[#d13f1f] bg-[#d13f1f] text-white" : "border-[#eadbd1] bg-white text-[#4d403a]"
            )}
          >
            {item.label}
          </button>
        ))}
        {categoryFilter ? (
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d13f1f] bg-[#fff2ef] px-3 py-1.5 text-xs font-semibold text-[#d13f1f]"
          >
            {CATEGORY_META[categoryFilter].label} ×
          </button>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {friendsWithMatchingOrders.length > 0 ? (
          friendsWithMatchingOrders.map((friend) => (
            <FriendCard
              key={friend.name}
              friend={friend}
              filter={filter}
              categoryFilter={categoryFilter}
              from={from}
              to={to}
              expanded={isExpanded(friend.name)}
              onToggle={() => toggle(friend.name)}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#eadbd1] bg-white p-4 text-center text-xs text-[#8a7a72]">
            Không có khách giới thiệu nào khớp trong khoảng thời gian này.
          </p>
        )}
      </div>
    </section>
  );
}

type OrderWithFriend = ReferralOrder & { friendName: string };

function buildChartBars(orders: OrderWithFriend[], from: Date, to: Date) {
  const completed = orders.filter((order) => order.status === "COMPLETED");
  const spanDays = differenceInCalendarDays(to, from);
  const granularity: "day" | "week" | "month" = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";
  const granularityLabel = granularity === "day" ? "ngày" : granularity === "week" ? "tuần" : "tháng";

  const buckets = new Map<string, { label: string; amount: number }>();
  for (const order of completed) {
    const d = parseISO(order.isoDate);
    let key: string;
    let label: string;
    if (granularity === "day") {
      key = order.isoDate;
      label = format(d, "dd/MM");
    } else if (granularity === "week") {
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      key = format(weekStart, "yyyy-MM-dd");
      label = format(weekStart, "dd/MM");
    } else {
      key = format(d, "yyyy-MM");
      label = format(d, "MM/yyyy");
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.amount += order.commission;
    } else {
      buckets.set(key, { label, amount: order.commission });
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort();
  const bars = sortedKeys.map((key) => ({ key, ...buckets.get(key)! }));
  return Object.assign(bars, { granularityLabel });
}

function buildDonutSegments(totals: Record<ReferralOrderCategory, number>, grandTotal: number) {
  const GAP = 1.2;
  let cumulative = 0;
  const order: ReferralOrderCategory[] = ["BUSINESS", "GROUP", "INDIVIDUAL"];
  return order.map((key) => {
    const value = totals[key];
    const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
    const start = cumulative;
    cumulative += pct;
    const visiblePct = Math.max(0, pct - GAP);
    return {
      key,
      value,
      pct,
      color: CATEGORY_META[key].color,
      offset: 100 - start,
      dasharray: `${visiblePct} ${100 - visiblePct}`,
    };
  });
}

function FriendCard({
  friend,
  filter,
  categoryFilter,
  from,
  to,
  expanded,
  onToggle,
}: {
  friend: ReferralFriend;
  filter: OrderFilter;
  categoryFilter: ReferralOrderCategory | null;
  from: Date;
  to: Date;
  expanded: boolean;
  onToggle: () => void;
}) {
  const inRangeOrders = friend.orders
    .filter((order) => isWithinInterval(parseISO(order.isoDate), { start: from, end: to }))
    .filter((order) => !categoryFilter || order.category === categoryFilter);
  const orders = inRangeOrders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "confirmed") return order.status === "COMPLETED";
    return order.status === "SCHEDULED";
  });
  const confirmedCount = inRangeOrders.filter((order) => order.status === "COMPLETED").length;
  const projectedCount = inRangeOrders.filter((order) => order.status === "SCHEDULED").length;
  const rewardInRange = inRangeOrders.filter((order) => order.status === "COMPLETED").reduce((sum, order) => sum + order.commission, 0);

  return (
    <div className="rounded-xl border border-[#eadbd1] bg-white p-3.5">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{friend.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                friend.status === "COMPLETED" ? "bg-[#fff4e6] text-[#b86b1f]" : "bg-[#fff7ec] text-[#8a5a12]"
              )}
            >
              {friend.status === "COMPLETED" ? "Đã hoàn thành" : "Đang chờ"}
            </span>
            {confirmedCount > 0 ? <span className="text-[10px] text-[#8a7a72]">{confirmedCount} đơn đã chốt</span> : null}
            {projectedCount > 0 ? <span className="text-[10px] text-[#8a7a72]">{projectedCount} đơn dự kiến</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm font-semibold text-[#b86b1f]">{rewardInRange > 0 ? `+${formatMoney(rewardInRange)}` : "—"}</span>
          <ChevronDown size={14} className={cn("text-[#8a7a72] transition", expanded && "rotate-180")} />
        </span>
      </button>

      {expanded ? (
        <div className="mt-2.5 space-y-2 border-t border-dashed border-[#eadbd1] pt-2.5">
          <p className="text-[11px] text-[#8a7a72]">
            {friend.note} · Tham gia {friend.joinedAt}
          </p>
          {orders.length > 0 ? (
            orders.map((order) => {
              const meta = CATEGORY_META[order.category];
              return (
                <div key={order.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#fdf8f5] px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[#191414]">{order.serviceLabel}</span>
                      {order.category !== "INDIVIDUAL" ? (
                        <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", meta.badge)}>
                          {order.category === "GROUP" ? <Users size={9} /> : <Building2 size={9} />}
                          {order.category === "GROUP" ? "Nhóm" : "Business"}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[#8a7a72]">
                      Bạn chi {formatMoney(order.amount)} · {order.date}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn("block text-sm font-semibold", order.status === "COMPLETED" ? "text-[#b86b1f]" : "text-[#8a5a12]")}>
                      +{formatMoney(order.commission)}
                    </span>
                    <span className="text-[9px] text-[#8a7a72]">{order.status === "COMPLETED" ? "Đã xác nhận" : "Dự kiến"}</span>
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-[#8a7a72]">Không có đơn hàng nào khớp bộ lọc.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
