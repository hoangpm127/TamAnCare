export const AFFILIATE_ORIGIN = "https://tamancenter.io.vn";

export function absoluteAffiliateLink(path: string) {
  return new URL(path, `${AFFILIATE_ORIGIN}/`).toString();
}
