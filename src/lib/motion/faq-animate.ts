/**
 * Fail-open FAQ open/close height-animation utility (spec: "FAQ Accordion
 * Open/Close Animation"; design decision #6, "FAQ height animation"). The
 * native `<details>`/`<summary>` element already provides a fully
 * accessible, keyboard-operable, instant disclosure by default — this
 * module only ever ADDS a smooth `max-height` transition on top of that
 * native behavior, intercepting the `summary` `click` event to animate the
 * open/close instead of letting the browser toggle instantly. Every answer
 * stays present in the initial HTML (never injected), and no static CSS
 * ever sets `max-height: 0` — only this module's inline styles do, and only
 * after it has already decided to intercept the click. If this module never
 * runs (no JS) or the user prefers reduced motion, the native `<details>`
 * element keeps working exactly as it always has: instant, fully
 * keyboard-operable, content never hidden.
 */

/** No-op disconnect returned from every fail-open early exit, so callers can
 * always treat the return value as a safe, callable teardown function. */
function noopDisconnect(): void {}

function syncAriaExpanded(summary: HTMLElement, details: HTMLDetailsElement): void {
  summary.setAttribute("aria-expanded", details.open ? "true" : "false");
}

/** Opens `details` immediately (so its content is renderable/measurable),
 * then animates the answer's `max-height` from 0 to its natural height. */
function animateOpen(details: HTMLDetailsElement, answer: HTMLElement): void {
  details.open = true;
  answer.style.overflow = "hidden";
  answer.style.maxHeight = "0px";
  // Force a reflow so the browser registers the 0px starting point before
  // the target height is applied below — otherwise both changes would
  // collapse into a single frame and the transition would never run.
  void answer.offsetHeight;
  const targetHeight = answer.scrollHeight;
  answer.style.maxHeight = `${targetHeight}px`;

  function onTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName !== "max-height") {
      return;
    }
    answer.removeEventListener("transitionend", onTransitionEnd);
    answer.style.maxHeight = "";
    answer.style.overflow = "";
  }
  answer.addEventListener("transitionend", onTransitionEnd);
}

/** Animates the answer's `max-height` down to 0 from its current height,
 * only flipping `details.open` to false once that transition completes —
 * keeping the native element accessibly "open" for the full duration of the
 * visual collapse. */
function animateClose(details: HTMLDetailsElement, answer: HTMLElement): void {
  const currentHeight = answer.scrollHeight;
  answer.style.overflow = "hidden";
  answer.style.maxHeight = `${currentHeight}px`;
  void answer.offsetHeight;
  answer.style.maxHeight = "0px";

  function onTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName !== "max-height") {
      return;
    }
    answer.removeEventListener("transitionend", onTransitionEnd);
    details.open = false;
    answer.style.maxHeight = "";
    answer.style.overflow = "";
  }
  answer.addEventListener("transitionend", onTransitionEnd);
}

export function initFaqAnimation(root: ParentNode = document): () => void {
  if (typeof window === "undefined") {
    return noopDisconnect;
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const items = root.querySelectorAll<HTMLDetailsElement>("[data-faq-item]");
  if (items.length === 0) {
    return noopDisconnect;
  }

  const teardowns: Array<() => void> = [];

  for (const details of items) {
    const summary = details.querySelector<HTMLElement>("summary");
    const answer = details.querySelector<HTMLElement>("[data-faq-answer]");
    if (!summary || !answer) {
      continue;
    }

    syncAriaExpanded(summary, details);

    // Kept active in every mode (including reduced motion) — this is the
    // sole mechanism keeping `aria-expanded` correct whenever `details.open`
    // changes for any reason other than our own intercepted click below.
    const handleToggle = () => syncAriaExpanded(summary, details);
    details.addEventListener("toggle", handleToggle);
    teardowns.push(() => details.removeEventListener("toggle", handleToggle));

    if (prefersReducedMotion) {
      // Reduced motion: never intercept the click. The native instant
      // toggle already provides the accessible open/close behavior.
      continue;
    }

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      const willOpen = !details.open;
      if (willOpen) {
        animateOpen(details, answer);
      } else {
        animateClose(details, answer);
      }
      // Set explicitly to the target state immediately: the visual/
      // interactive state change begins now, even though `animateClose`
      // defers flipping the native `open` attribute until `transitionend`.
      summary.setAttribute("aria-expanded", String(willOpen));
    };
    summary.addEventListener("click", handleClick);
    teardowns.push(() => summary.removeEventListener("click", handleClick));
  }

  let disconnected = false;
  return function disconnect() {
    if (disconnected) {
      return;
    }
    disconnected = true;
    for (const teardown of teardowns) {
      teardown();
    }
  };
}

// Auto-init once, site-wide, on module import (same convention as
// `scroll-reveal.ts`/`header-scroll.ts`). The returned `disconnect()` is
// intentionally unused here — re-init after client-side navigation is wired
// up in `BaseLayout.astro` in a later PR (design decision #9).
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initFaqAnimation());
  } else {
    initFaqAnimation();
  }
}
