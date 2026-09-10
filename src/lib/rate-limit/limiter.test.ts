import { describe, expect, it } from "vitest";
import { createInMemoryRateLimiter } from "./limiter";

describe("createInMemoryRateLimiter", () => {
  it("allows requests under the configured limit within the window", async () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 3 });

    const first = await limiter.consume("client-a");
    const second = await limiter.consume("client-a");
    const third = await limiter.consume("client-a");

    expect(first).toEqual({ allowed: true });
    expect(second).toEqual({ allowed: true });
    expect(third).toEqual({ allowed: true });
  });

  it("blocks a request once the client exceeds the limit inside the window", async () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2 });

    await limiter.consume("client-b");
    await limiter.consume("client-b");
    const third = await limiter.consume("client-b");

    expect(third).toEqual({ allowed: false });
  });

  it("tracks each client identifier independently", async () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 1 });

    const clientA = await limiter.consume("client-c");
    const clientB = await limiter.consume("client-d");

    expect(clientA).toEqual({ allowed: true });
    expect(clientB).toEqual({ allowed: true });
  });

  it("allows requests again once the window has elapsed", async () => {
    let currentTime = 0;
    const limiter = createInMemoryRateLimiter(
      { windowMs: 1_000, maxRequests: 1 },
      () => currentTime,
    );

    const first = await limiter.consume("client-e");
    const second = await limiter.consume("client-e");
    currentTime = 1_001;
    const third = await limiter.consume("client-e");

    expect(first).toEqual({ allowed: true });
    expect(second).toEqual({ allowed: false });
    expect(third).toEqual({ allowed: true });
  });
});
