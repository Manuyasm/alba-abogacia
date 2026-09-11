/**
 * Fail-open header scroll-compaction utility (spec: "Header Scroll
 * Compaction"; design decision #7, "Header compaction"). The header is
 * always `position: sticky` and never hidden — this module only ever ADDS
 * the `.is-compact` class to the `[data-header]` element once the page has
 * scrolled past a small threshold, and REMOVES it when scrolled back above
 * that threshold. If this module never runs (no JS, or an unsupported
 * environment), the header stays in its default, fully visible,
 * uncompacted state — never auto-hidden, never broken.
 */

/** Matches design decision #7: compaction triggers once the header is
 * already stuck at scroll > 24px. */
const SCROLL_THRESHOLD = 24;

/** No-op disconnect returned from every fail-open early exit, so callers can
 * always treat the return value as a safe, callable teardown function. */
function noopDisconnect(): void {}

export function initHeaderScroll(root: ParentNode = document): () => void {
  if (typeof window === "undefined") {
    return noopDisconnect;
  }

  const header = root.querySelector<HTMLElement>("[data-header]");
  if (!header) {
    return noopDisconnect;
  }

  function applyState(): void {
    header!.classList.toggle("is-compact", window.scrollY > SCROLL_THRESHOLD);
  }

  applyState();
  window.addEventListener("scroll", applyState, { passive: true });

  let disconnected = false;
  return function disconnect() {
    if (disconnected) {
      return;
    }
    disconnected = true;
    window.removeEventListener("scroll", applyState);
  };
}

// Auto-init once, site-wide, on module import (same convention as
// `scroll-reveal.ts`). The returned `disconnect()` is intentionally unused
// here — re-init after client-side navigation is wired up in
// `BaseLayout.astro` in a later PR (design decision #9).
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initHeaderScroll());
  } else {
    initHeaderScroll();
  }
}
