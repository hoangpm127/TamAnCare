export const VENUE_DIRECT_SOURCE = "VENUE_DIRECT" as const;

export function isVenueDirectSource(value: string | null | undefined) {
  return value === VENUE_DIRECT_SOURCE;
}
