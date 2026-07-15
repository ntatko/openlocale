import type { Context, Next } from "hono";
import type { ApiEnv } from "./app.js";

type Bucket = { tokens: number; updatedAt: number };

/**
 * In-memory token bucket keyed by client IP — protects the public CDN
 * endpoints on a single instance. Fronting proxies/CDNs should do the heavy
 * lifting in serious deployments; this is the backstop.
 */
export function rateLimit(opts?: { perMinute?: number; burst?: number }) {
  const perMinute = opts?.perMinute ?? Number(process.env.OPENLOCALE_CDN_RATE_LIMIT ?? 300);
  const burst = opts?.burst ?? perMinute;
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return async (c: Context<ApiEnv>, next: Next) => {
    if (perMinute <= 0) return next(); // disabled via env

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "local";

    const now = Date.now();
    // hourly sweep so idle buckets don't accumulate forever
    if (now - lastSweep > 3_600_000) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.updatedAt > 300_000) buckets.delete(key);
      }
      lastSweep = now;
    }

    const bucket = buckets.get(ip) ?? { tokens: burst, updatedAt: now };
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.updatedAt) / 60_000) * perMinute);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      buckets.set(ip, bucket);
      return c.json(
        { error: { code: "RATE_LIMITED", message: "too many requests" } },
        429,
        { "retry-after": "10" }
      );
    }
    bucket.tokens -= 1;
    buckets.set(ip, bucket);
    await next();
  };
}
