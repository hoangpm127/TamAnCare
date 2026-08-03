const FALLBACK_SITE_URL = "https://tamancare-production.up.railway.app";

export function siteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}
