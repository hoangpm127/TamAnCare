const DEFAULT_CUSTOMER_RETURN_PATH = "/tai-khoan";

export function safeCustomerReturnPath(
  value: string | null | undefined,
  fallback = DEFAULT_CUSTOMER_RETURN_PATH,
) {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const parsed = new URL(candidate, "https://tamancare.local");
    if (parsed.origin !== "https://tamancare.local" || parsed.pathname.startsWith("/api/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
