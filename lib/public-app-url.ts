function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized === "0.0.0.0"
    || normalized === "::1"
    || normalized === "[::1]";
}

export function publicAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || isLoopbackHostname(url.hostname))) {
      throw new Error("NEXT_PUBLIC_APP_URL production phải dùng HTTPS và không được trỏ tới localhost.");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_APP_URL chưa được cấu hình.");
  return new URL(request.url).origin;
}

export function publicAppUrl(path: string, request: Request) {
  return new URL(path, `${publicAppOrigin(request)}/`);
}
