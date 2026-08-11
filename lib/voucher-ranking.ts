export type VoucherAudience = "ANONYMOUS" | "NEW" | "RETURNING";

export type VoucherRankingCandidate = {
  code: string;
  serviceId: string | null;
  bookingStartMinuteMin: number | null;
  bookingStartMinuteMax: number | null;
  inventoryAvailable: boolean;
  eligible: boolean;
  visible: boolean;
  createdAt: Date;
};

export type VoucherRankingContext = {
  audience: VoucherAudience;
  minuteOfDay: number;
  serviceIds: string[];
};

export type VoucherRecommendationReason = "TIME_WINDOW" | "NEW_CUSTOMER" | "RETURNING_CUSTOMER" | "GENERAL";

function matchesSelectedServices(candidate: VoucherRankingCandidate, serviceIds: string[]) {
  return serviceIds.length === 0 || candidate.serviceId === null || serviceIds.every((id) => id === candidate.serviceId);
}

function matchesTimeWindow(candidate: VoucherRankingCandidate, minuteOfDay: number) {
  if (candidate.bookingStartMinuteMin === null && candidate.bookingStartMinuteMax === null) return false;
  if (candidate.bookingStartMinuteMin !== null && minuteOfDay < candidate.bookingStartMinuteMin) return false;
  if (candidate.bookingStartMinuteMax !== null && minuteOfDay >= candidate.bookingStartMinuteMax) return false;
  return true;
}

export function voucherRecommendationReason(
  candidate: VoucherRankingCandidate,
  context: VoucherRankingContext,
): VoucherRecommendationReason {
  if (matchesTimeWindow(candidate, context.minuteOfDay) && matchesSelectedServices(candidate, context.serviceIds)) {
    return "TIME_WINDOW";
  }
  if ((context.audience === "NEW" || context.audience === "ANONYMOUS") && candidate.code === "WELCOME150") {
    return "NEW_CUSTOMER";
  }
  if (context.audience === "RETURNING" && candidate.code === "RETURN100") {
    return "RETURNING_CUSTOMER";
  }
  return "GENERAL";
}

function recommendationScore(candidate: VoucherRankingCandidate, context: VoucherRankingContext) {
  if (!candidate.visible) return Number.NEGATIVE_INFINITY;
  const reason = voucherRecommendationReason(candidate, context);
  const reasonScore = reason === "TIME_WINDOW"
    ? 5_000
    : reason === "NEW_CUSTOMER" || reason === "RETURNING_CUSTOMER"
      ? 3_000
      : 0;
  return reasonScore + (candidate.eligible ? 1_000 : 0) + (candidate.inventoryAvailable ? 0 : -20_000);
}

export function rankVoucherCandidates<T extends VoucherRankingCandidate>(
  candidates: T[],
  context: VoucherRankingContext,
) {
  return candidates
    .filter((candidate) => candidate.visible)
    .map((candidate) => ({
      ...candidate,
      recommendationReason: voucherRecommendationReason(candidate, context),
      recommendationScore: recommendationScore(candidate, context),
    }))
    .sort((left, right) =>
      right.recommendationScore - left.recommendationScore
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.code.localeCompare(right.code),
    );
}
