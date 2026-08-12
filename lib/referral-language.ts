import {
  isCustomerLanguage,
  type CustomerLanguage,
} from "@/lib/customer-i18n";

type SearchParamValue = string | string[] | undefined;

export function referralPathForLanguage(code: string, language: CustomerLanguage) {
  const path = `/r/${encodeURIComponent(code)}`;
  return language === "vi" ? path : `${path}?lang=${language}`;
}

export function resolveReferralLanguage(
  requestedLanguage: SearchParamValue,
  ownerPreferredLanguage: string | null | undefined,
): CustomerLanguage {
  const requested = Array.isArray(requestedLanguage) ? requestedLanguage[0] : requestedLanguage;
  if (isCustomerLanguage(requested)) return requested;
  if (isCustomerLanguage(ownerPreferredLanguage)) return ownerPreferredLanguage;
  return "vi";
}
