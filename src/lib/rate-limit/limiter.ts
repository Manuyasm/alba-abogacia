/**
 * Server-side rate limiting for `POST /api/contacto` (spec: "Rate Limiting and
 * Honeypot" — "Cap verification alone MUST NOT be treated as sufficient bot
 * protection").
 *
 * `createInMemoryRateLimiter` is a fixed-window limiter keyed by client
 * identifier, safe for the current single-instance `@astrojs/node` standalone
 * deployment. Wiring this store to the shared Valkey instance (tasks.md 6.3,
 * needed once the app runs as more than one instance) requires choosing and
 * adding a Redis/Valkey client dependency — an infra decision outside this
 * PR's authorized scope, so it is tracked as an OPEN ITEM rather than
 * fabricated here. `createRateLimiter()` is the single call site the route
 * uses, so swapping in a Valkey-backed implementation later does not require
 * touching `src/pages/api/contacto.ts`.
 */

export interface RateLimitResult {
  allowed: boolean;
}

export interface RateLimiter {
  consume(clientId: string): Promise<RateLimitResult>;
}

export interface RateLimiterConfig {
  /** Size of the fixed window, in milliseconds. */
  windowMs: number;
  /** Maximum allowed requests per client identifier within one window. */
  maxRequests: number;
}

type Clock = () => number;

/**
 * Fixed-window limiter: each client identifier gets a request counter that
 * resets once `windowMs` has elapsed since that client's first request in the
 * current window. `clock` is injectable so behavior at window boundaries is
 * deterministic under test.
 */
export function createInMemoryRateLimiter(
  config: RateLimiterConfig,
  clock: Clock = Date.now,
): RateLimiter {
  const windows = new Map<string, { count: number; windowStart: number }>();

  return {
    async consume(clientId: string): Promise<RateLimitResult> {
      const now = clock();
      const existing = windows.get(clientId);

      if (!existing || now - existing.windowStart >= config.windowMs) {
        windows.set(clientId, { count: 1, windowStart: now });
        return { allowed: true };
      }

      if (existing.count >= config.maxRequests) {
        return { allowed: false };
      }

      existing.count += 1;
      return { allowed: true };
    },
  };
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60_000,
  maxRequests: 5,
};

/**
 * Single call site the route depends on. Returns the in-memory adapter today;
 * see module docstring for the Valkey-backed OPEN ITEM.
 */
export function createRateLimiter(config: RateLimiterConfig = DEFAULT_CONFIG): RateLimiter {
  return createInMemoryRateLimiter(config);
}
