/** Fixed-window in-memory limiter. Fine for one instance; swap for a shared store if you scale out. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const t = now();
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count++;
    if (entry.count > limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - t) / 1000) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
