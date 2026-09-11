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
 */
export function initScrollReveal(root: ParentNode = document): void {
  if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
    return;
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return;
  }

  const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
  if (elements.length === 0) {
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }
      const target = entry.target;
      target.classList.remove("reveal-pending");
      target.classList.add("reveal-visible");
      obs.unobserve(target);
    }
  });

  for (const element of elements) {
    element.classList.add("reveal-pending");
    observer.observe(element);
  }
}

// Auto-init once, site-wide, on module import (design: "auto-inits on import
// via DOMContentLoaded/immediate check"). Guarded for non-browser/test
// environments where `document` may be absent.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initScrollReveal());
  } else {
    initScrollReveal();
  }
}
