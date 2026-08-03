import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

export function reportsIncludeDemoLedger() {
  return process.env.APP_ENV !== "production";
}

export function ledgerReportWhere(): Prisma.LedgerEntryWhereInput {
  return reportsIncludeDemoLedger() ? {} : { dataOrigin: { not: "DEMO" } };
}

export function summarizeLedgerOrigins<T extends { dataOrigin: string; amount: number }>(entries: T[]) {
  const summary = {
    LIVE: { count: 0, amount: 0 },
    IMPORTED: { count: 0, amount: 0 },
    DEMO: { count: 0, amount: 0 },
  };
  for (const entry of entries) {
    const key = entry.dataOrigin as keyof typeof summary;
    if (!summary[key]) continue;
    summary[key].count += 1;
    summary[key].amount += entry.amount;
  }
  return {
    reportingMode: reportsIncludeDemoLedger() ? "UAT_WITH_DEMO" as const : "PRODUCTION_LIVE_ONLY" as const,
    includesDemoData: reportsIncludeDemoLedger() && summary.DEMO.count > 0,
    origins: summary,
  };
}
