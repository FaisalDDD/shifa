import "server-only";

/**
 * Lightweight in-memory fixed-window rate limiter for sensitive endpoints
 * (auth, search, reservation). Suitable for a single server instance.
 *
 * Production note: on multi-instance/serverless deployments this state is not
 * shared. Replace with a distributed store (e.g. Upstash Ratelimit) when
 * scaling horizontally. The interface is intentionally narrow to allow that.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Periodically prune stale entries so the map cannot grow without bound.
let lastPrune = Date.now();
function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit,
    remaining: limit - current.count,
    retryAfterSeconds: 0,
  };
}

/** Build a stable bucket key from an IP or user id + action. */
export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${identifier}`;
}

export const RATE_LIMITS = {
  auth: { limit: 20, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  reservation: { limit: 15, windowMs: 60_000 },
} as const;
