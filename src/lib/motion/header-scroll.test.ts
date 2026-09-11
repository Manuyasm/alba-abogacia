import { afterEach, describe, expect, it, vi } from "vitest";
import { initHeaderScroll } from "./header-scroll";

/**
 * Unit tests for the fail-open header scroll-compaction utility (spec:
 * "Header Scroll Compaction"; design decision #7, "Header compaction" — the
 * header stays `position: sticky` and fully visible at all times; JS only
 * ever ADDS/REMOVES the `.is-compact` class based on scroll position, never
 * hides the header, and returns an idempotent `disconnect()` used by a
 * future PR (F) to re-init after client-side navigation).
 */

function buildHeaderContainer(): { root: HTMLElement; header: HTMLElement } {
  const root = document.createElement("div");
  const header = document.createElement("header");
  header.setAttribute("data-header", "");
  root.appendChild(header);
  return { root, header };
}

function setScrollY(value: number): void {
  Object.defineProperty(window, "scrollY", { value, configurable: true, writable: true });
}

afterEach(() => {
  setScrollY(0);
  vi.restoreAllMocks();
});

describe("initHeaderScroll — no [data-header] element present", () => {
  it("returns a callable no-op disconnect() and never throws", () => {
    const root = document.createElement("div");

    const disconnect = initHeaderScroll(root);

    expect(() => disconnect()).not.toThrow();
  });
});

describe("initHeaderScroll — scroll threshold", () => {
  it("does not add is-compact before the scroll threshold", () => {
    const { root, header } = buildHeaderContainer();
    setScrollY(0);

    initHeaderScroll(root);

    expect(header.classList.contains("is-compact")).toBe(false);
  });

  it("adds is-compact once scrolled past the threshold", () => {
    const { root, header } = buildHeaderContainer();
    setScrollY(0);

    initHeaderScroll(root);
    setScrollY(50);
    window.dispatchEvent(new Event("scroll"));

    expect(header.classList.contains("is-compact")).toBe(true);
  });

  it("removes is-compact when scrolled back above the threshold", () => {
    const { root, header } = buildHeaderContainer();
    setScrollY(50);

    initHeaderScroll(root);
    expect(header.classList.contains("is-compact")).toBe(true);

    setScrollY(0);
    window.dispatchEvent(new Event("scroll"));

    expect(header.classList.contains("is-compact")).toBe(false);
  });

  it("never hides the header (no display:none, stays attached) regardless of scroll state", () => {
    const { root, header } = buildHeaderContainer();

    initHeaderScroll(root);
    setScrollY(999);
    window.dispatchEvent(new Event("scroll"));

    expect(root.contains(header)).toBe(true);
    expect(header.style.display).not.toBe("none");
  });
});

describe("initHeaderScroll — disconnect", () => {
  it("returns a disconnect() that stops updating is-compact on further scroll events, and is idempotent", () => {
    const { root, header } = buildHeaderContainer();
    setScrollY(0);

    const disconnect = initHeaderScroll(root);
    disconnect();
    disconnect(); // idempotent, must not throw or double-detach

    setScrollY(999);
    window.dispatchEvent(new Event("scroll"));

    expect(header.classList.contains("is-compact")).toBe(false);
  });
});
