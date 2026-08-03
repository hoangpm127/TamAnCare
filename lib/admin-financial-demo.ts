export type DemoDayPart = "all" | "morning" | "afternoon" | "evening";

export type DemoFinanceSummary = {
  serviceRevenue: number;
  tips: number;
  expenses: number;
  expectedRevenue: number;
  bookingCount: number;
  customerCount: number;
  roomUtilization: number;
  therapistUtilization: number;
};

const BRANCH_FACTORS: Record<string, number> = { cs1: 0.985, cs2: 1.01 };
const DAY_PART_FACTORS: Record<DemoDayPart, number> = { all: 1, morning: 0.24, afternoon: 0.41, evening: 0.35 };

function startOfCurrentYear(anchor: Date) {
  return new Date(anchor.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfCurrentYear(anchor: Date) {
  return new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function emptySummary(): DemoFinanceSummary {
  return { serviceRevenue: 0, tips: 0, expenses: 0, expectedRevenue: 0, bookingCount: 0, customerCount: 0, roomUtilization: 0, therapistUtilization: 0 };
}

function dailyRevenue(date: Date, branchId: string) {
  const dayKey = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const deterministicSwing = 0.93 + ((dayKey * 17 + (branchId === "cs2" ? 5 : 0)) % 16) / 100;
  const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 1.11 : 0.96;
  const seasonalFactor = 0.98 + ((date.getMonth() * 7 + 3) % 6) / 100;
  return Math.round((8_350_000 * (BRANCH_FACTORS[branchId] ?? 1) * deterministicSwing * weekendFactor * seasonalFactor) / 10_000) * 10_000;
}

export function getDemoFinanceSummary({
  start,
  end,
  branchId = "all",
  dayPart = "all",
  anchor = new Date(),
}: {
  start?: Date | null;
  end?: Date | null;
  branchId?: string;
  dayPart?: DemoDayPart;
  anchor?: Date;
}): DemoFinanceSummary {
  const rangeStart = start ? new Date(start) : startOfCurrentYear(anchor);
  const rangeEnd = end ? new Date(end) : endOfCurrentYear(anchor);
  const branchIds = branchId === "all" ? Object.keys(BRANCH_FACTORS) : [branchId];
  const partFactor = DAY_PART_FACTORS[dayPart];
  const result = emptySummary();
  let dayCount = 0;

  for (const id of branchIds) {
    for (let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
      dayCount += 1;
      const serviceRevenue = Math.round((dailyRevenue(cursor, id) * partFactor) / 10_000) * 10_000;
      const tips = Math.round((serviceRevenue * (0.112 + ((cursor.getDate() + (id === "cs2" ? 2 : 0)) % 4) * 0.006)) / 10_000) * 10_000;
      const expenses = Math.round((serviceRevenue * (0.605 + ((cursor.getDate() + cursor.getMonth()) % 5) * 0.009)) / 10_000) * 10_000;
      const bookings = Math.max(1, Math.round(serviceRevenue / 342_000));
      result.serviceRevenue += serviceRevenue;
      result.tips += tips;
      result.expenses += expenses;
      result.expectedRevenue += Math.round((serviceRevenue * 1.075) / 10_000) * 10_000;
      result.bookingCount += bookings;
      result.customerCount += Math.round(bookings * 0.84);
    }
  }

  const dailyPerBranch = dayCount ? result.bookingCount / dayCount : 0;
  result.roomUtilization = Math.min(94, Math.round(61 + dailyPerBranch * 0.72 + (dayPart === "evening" ? 6 : dayPart === "morning" ? -4 : 0)));
  result.therapistUtilization = Math.min(96, Math.round(result.roomUtilization + 4));
  return result;
}
