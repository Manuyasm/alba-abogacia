import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initScrollReveal } from "./scroll-reveal";

/**
 * Unit tests for the fail-open scroll-reveal utility (spec: "Fail-Open
 * Scroll-Reveal"; design: "Scroll-reveal state model" — elements are visible
 * by default in CSS, JS only ever ADDS a pending/visible class pair after
 * confirming both browser feature support and the user's motion preference).
 *
 * `initScrollReveal` also runs once automatically on module import (design:
 * "auto-inits on import"). That side effect fires before these mocks exist
 * and finds no `[data-reveal]` elements in the empty jsdom document, so it is
 * harmless here — every test below calls the exported function explicitly
 * against an isolated `root` container instead of relying on the auto-init.
 */

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  unobserve = vi.fn((el: Element) => {
    this.observed = this.observed.filter((observed) => observed !== el);
  });
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
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

function buildRevealContainer(): { root: HTMLElement; element: HTMLElement } {
  const root = document.createElement("div");
  const element = document.createElement("section");
  element.setAttribute("data-reveal", "");
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
});

describe("initScrollReveal — supported browser, no reduced-motion preference", () => {
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
});
