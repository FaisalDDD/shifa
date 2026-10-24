import "server-only";

export function searchParamsObject(
  request: Request,
): Record<string, string> {
  const url = new URL(request.url);
  const out: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Best-effort client identifier for rate limiting (IP or a stable token). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "local";
}
