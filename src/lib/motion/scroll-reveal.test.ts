import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initScrollReveal } from "./scroll-reveal";

/**
 * Unit tests for the fail-open scroll-reveal utility (spec: "Fail-Open
 * Scroll-Reveal"; design: "Scroll-reveal state model" — elements are visible
 * by default in CSS, JS only ever ADDS a pending/visible class pair after
 * confirming both browser feature support and the user's motion preference).
 *
 * PR B extends this contract: 5 variants (`fade-up`/`fade`/`fade-left`/
 * `fade-right`/`stagger`) selected purely via the `[data-reveal="…"]` CSS
 * attribute selector (JS stays variant-agnostic — it only toggles the
 * pending/visible classes, regardless of which variant value is present), an
 * explicit ~15% intersection threshold, and a returned `disconnect()` used by
 * `BaseLayout.astro` (PR F) to re-init after client-side navigation.
 *
 * As of PR F, `initScrollReveal` no longer self-invokes on module import —
 * `BaseLayout.astro`'s `astro:page-load` listener is the sole caller. Every
 * test below calls the exported function explicitly against an isolated
 * `root` container.
 */

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  unobserve = vi.fn((el: Element) => {
    this.observed = this.observed.filter((observed) => observed !== el);
  });
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, media: "(prefers-reduced-motion: reduce)" }),
  );
}

function buildRevealContainer(variant = ""): { root: HTMLElement; element: HTMLElement } {
  const root = document.createElement("div");
  const element = document.createElement("section");
  element.setAttribute("data-reveal", variant);
  root.appendChild(element);
  return { root, element };
}

/** Builds a minimal fake `IntersectionObserverEntry` for triggering the
 * mocked observer's callback directly in tests. */
function buildEntry(isIntersecting: boolean, target: Element): IntersectionObserverEntry {
  return { isIntersecting, target } as unknown as IntersectionObserverEntry;
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initScrollReveal — reduced motion", () => {
  it("does not add a pending class and never constructs an IntersectionObserver when reduced motion is preferred", () => {
    stubMatchMedia(true);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root, element } = buildRevealContainer();

    initScrollReveal(root);

    expect(element.classList.contains("reveal-pending")).toBe(false);
    expect(element.classList.contains("reveal-visible")).toBe(false);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("returns a callable no-op disconnect() when reduced motion is preferred", () => {
    stubMatchMedia(true);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root } = buildRevealContainer();

    const disconnect = initScrollReveal(root);

    expect(() => disconnect()).not.toThrow();
  });
});

describe("initScrollReveal — unsupported IntersectionObserver", () => {
  it("does not add a pending class when IntersectionObserver is unavailable", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", undefined);
    const { root, element } = buildRevealContainer();

    initScrollReveal(root);

    expect(element.classList.contains("reveal-pending")).toBe(false);
    expect(element.classList.contains("reveal-visible")).toBe(false);
  });

  it("returns a callable no-op disconnect() when IntersectionObserver is unavailable", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", undefined);
    const { root } = buildRevealContainer();

    const disconnect = initScrollReveal(root);

    expect(() => disconnect()).not.toThrow();
  });
});

describe("initScrollReveal — supported browser, no reduced-motion preference", () => {
  it("observes with a ~15% intersection threshold", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root } = buildRevealContainer();

    initScrollReveal(root);

    const observer = MockIntersectionObserver.instances[0];
    expect(observer?.options?.threshold).toBe(0.15);
  });

  it("adds reveal-pending immediately, then swaps to reveal-visible and unobserves on intersect", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root, element } = buildRevealContainer();

    initScrollReveal(root);

    expect(element.classList.contains("reveal-pending")).toBe(true);
    expect(element.classList.contains("reveal-visible")).toBe(false);

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();
    expect(observer!.observed).toContain(element);

    observer!.callback(
      [buildEntry(true, element)],
      observer as unknown as IntersectionObserver,
    );

    expect(element.classList.contains("reveal-pending")).toBe(false);
    expect(element.classList.contains("reveal-visible")).toBe(true);
    expect(observer!.unobserve).toHaveBeenCalledWith(element);
  });

  it("does not swap to reveal-visible for a non-intersecting entry", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root, element } = buildRevealContainer();

    initScrollReveal(root);
    const observer = MockIntersectionObserver.instances[0]!;

    observer.callback(
      [buildEntry(false, element)],
      observer as unknown as IntersectionObserver,
    );

    expect(element.classList.contains("reveal-pending")).toBe(true);
    expect(element.classList.contains("reveal-visible")).toBe(false);
    expect(observer.unobserve).not.toHaveBeenCalled();
  });

  it.each(["fade-up", "fade", "fade-left", "fade-right", "stagger"])(
    "toggles reveal-pending/reveal-visible the same way regardless of the '%s' variant value (variant selection is CSS-only)",
    (variant) => {
      stubMatchMedia(false);
      vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
      const { root, element } = buildRevealContainer(variant);

      initScrollReveal(root);
      expect(element.classList.contains("reveal-pending")).toBe(true);

      const observer = MockIntersectionObserver.instances[0]!;
      observer.callback(
        [buildEntry(true, element)],
        observer as unknown as IntersectionObserver,
      );

      expect(element.classList.contains("reveal-visible")).toBe(true);
    },
  );

  it("returns a disconnect() that calls the underlying observer's disconnect exactly once, even when invoked twice", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const { root } = buildRevealContainer();

    const disconnect = initScrollReveal(root);
    const observer = MockIntersectionObserver.instances[0]!;

    disconnect();
    disconnect();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("initScrollReveal — no [data-reveal] elements present", () => {
  it("returns a callable no-op disconnect() and never constructs an observer", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const root = document.createElement("div");

    const disconnect = initScrollReveal(root);

    expect(() => disconnect()).not.toThrow();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });
});
