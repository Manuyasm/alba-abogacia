/**
 * Fail-open scroll-reveal utility (spec: "Fail-Open Scroll-Reveal"; design:
 * "Scroll-reveal state model"). Elements marked `[data-reveal]` are visible
 * by default in CSS (see `src/styles/global.css`) — this module only ever
 * ADDS classes on top of that default, and only after confirming:
 *   1. `IntersectionObserver` is supported by the current browser, and
 *   2. the user has NOT requested `prefers-reduced-motion: reduce`.
 * If either check fails, this function returns immediately and does nothing:
 * the elements stay in their default, fully visible state. JS therefore
 * never becomes the sole mechanism making content visible.
 *
 * Variant selection (`fade-up`/`fade`/`fade-left`/`fade-right`/`stagger`) is
 * entirely CSS-driven via the `[data-reveal="…"]` attribute selector — this
 * module stays variant-agnostic and only ever toggles the shared
 * `.reveal-pending`/`.reveal-visible` class pair, regardless of which
 * variant value (or no value at all) an element carries.
 */
export type RevealVariant = "fade-up" | "fade" | "fade-left" | "fade-right" | "stagger";

/** Matches DESIGN.md §13's "~15% visible" entrance trigger. */
const REVEAL_THRESHOLD = 0.15;

/** No-op disconnect returned from every fail-open early exit, so callers can
 * always treat the return value as a safe, callable teardown function. */
function noopDisconnect(): void {}

export function initScrollReveal(root: ParentNode = document): () => void {
  if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
    return noopDisconnect;
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return noopDisconnect;
  }

  const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
  if (elements.length === 0) {
    return noopDisconnect;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const target = entry.target;
        target.classList.remove("reveal-pending");
        target.classList.add("reveal-visible");
        // One-shot: never re-observe an already-revealed element.
        obs.unobserve(target);
      }
    },
    { threshold: REVEAL_THRESHOLD },
  );

  for (const element of elements) {
    element.classList.add("reveal-pending");
    observer.observe(element);
  }

  let disconnected = false;
  return function disconnect() {
    if (disconnected) {
      return;
    }
    disconnected = true;
    observer.disconnect();
  };
}

// PR F (design decision #9, "ClientRouter re-init"): this module no longer
// self-invokes on import. `src/layouts/BaseLayout.astro` is now the SOLE
// owner of the init lifecycle, calling `initScrollReveal()` on every
// `astro:page-load` (which fires on both the very first page load and every
// subsequent client-side navigation) and disconnecting the previous
// instance first. A second, independent auto-init source here would
// double-bind on the very first load already.
