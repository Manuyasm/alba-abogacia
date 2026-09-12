import { afterEach, describe, expect, it, vi } from "vitest";
import { initFaqAnimation } from "./faq-animate";

/**
 * Unit tests for the fail-open FAQ open/close height-animation utility
 * (spec: "FAQ Accordion Open/Close Animation"; design decision #6, "FAQ
 * height animation" — native <details>/<summary> already provides an
 * instant, fully keyboard-operable, accessible disclosure; this module only
 * ever intercepts the `summary` click to animate `max-height` on top of
 * that, and never itself hides content via static CSS. When JS never runs,
 * or the user prefers reduced motion, the native instant toggle is the
 * fallback — this module then only mirrors `details.open` into
 * `aria-expanded` via the native `toggle` event, without intercepting
 * clicks).
 */

function buildFaqItem(open = false): {
  root: HTMLElement;
  details: HTMLDetailsElement;
  summary: HTMLElement;
  answer: HTMLElement;
} {
  const root = document.createElement("div");
  const details = document.createElement("details");
  details.setAttribute("data-faq-item", "");
  const summary = document.createElement("summary");
  const answer = document.createElement("p");
  answer.setAttribute("data-faq-answer", "");
  answer.textContent = "Respuesta de ejemplo.";
  details.appendChild(summary);
  details.appendChild(answer);
  if (open) {
    details.open = true;
  }
  root.appendChild(details);
  return { root, details, summary, answer };
}

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, media: "(prefers-reduced-motion: reduce)" }),
  );
}

function fireTransitionEnd(el: HTMLElement, propertyName = "max-height"): void {
  const event = new Event("transitionend") as TransitionEvent;
  Object.defineProperty(event, "propertyName", { value: propertyName });
  el.dispatchEvent(event);
}

function dispatchClick(el: HTMLElement): MouseEvent {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initFaqAnimation — no [data-faq-item] elements present", () => {
  it("returns a callable no-op disconnect()", () => {
    stubMatchMedia(false);
    const root = document.createElement("div");

    const disconnect = initFaqAnimation(root);

    expect(() => disconnect()).not.toThrow();
  });
});

describe("initFaqAnimation — initial aria-expanded state", () => {
  it("sets aria-expanded=false on a closed item", () => {
    stubMatchMedia(false);
    const { root, summary } = buildFaqItem(false);

    initFaqAnimation(root);

    expect(summary.getAttribute("aria-expanded")).toBe("false");
  });

  it("sets aria-expanded=true on an initially-open item", () => {
    stubMatchMedia(false);
    const { root, summary } = buildFaqItem(true);

    initFaqAnimation(root);

    expect(summary.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("initFaqAnimation — click interception (no reduced motion)", () => {
  it("prevents the native default toggle on summary click", () => {
    stubMatchMedia(false);
    const { root, summary } = buildFaqItem(false);
    initFaqAnimation(root);

    const event = dispatchClick(summary);

    expect(event.defaultPrevented).toBe(true);
  });

  it("opens the details element immediately and sets aria-expanded=true when clicked while closed", () => {
    stubMatchMedia(false);
    const { root, details, summary } = buildFaqItem(false);
    initFaqAnimation(root);

    dispatchClick(summary);

    expect(details.open).toBe(true);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
  });

  it("sets aria-expanded=false immediately on click when open, even before the close transition completes", () => {
    stubMatchMedia(false);
    const { root, details, summary } = buildFaqItem(true);
    initFaqAnimation(root);

    dispatchClick(summary);

    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(details.open).toBe(true); // still native-open until transitionend
  });

  it("closes the details element only after transitionend fires on the answer", () => {
    stubMatchMedia(false);
    const { root, details, summary, answer } = buildFaqItem(true);
    initFaqAnimation(root);

    dispatchClick(summary);
    expect(details.open).toBe(true);

    fireTransitionEnd(answer);

    expect(details.open).toBe(false);
  });

  it("ignores a transitionend event for an unrelated property", () => {
    stubMatchMedia(false);
    const { root, details, summary, answer } = buildFaqItem(true);
    initFaqAnimation(root);

    dispatchClick(summary);
    fireTransitionEnd(answer, "opacity");

    expect(details.open).toBe(true);
  });
});

describe("initFaqAnimation — content never hidden via static styles", () => {
  it("never sets a persistent inline max-height on the answer before any interaction", () => {
    stubMatchMedia(false);
    const { root, answer } = buildFaqItem(false);

    initFaqAnimation(root);

    expect(answer.style.maxHeight).toBe("");
  });
});

describe("initFaqAnimation — reduced motion fallback", () => {
  it("does not intercept (preventDefault) the click when reduced motion is preferred", () => {
    stubMatchMedia(true);
    const { root, summary } = buildFaqItem(false);
    initFaqAnimation(root);

    const event = dispatchClick(summary);

    expect(event.defaultPrevented).toBe(false);
  });

  it("still mirrors details.open into aria-expanded via the native toggle event", () => {
    stubMatchMedia(true);
    const { root, details, summary } = buildFaqItem(false);
    initFaqAnimation(root);

    details.open = true;
    details.dispatchEvent(new Event("toggle"));

    expect(summary.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("initFaqAnimation — disconnect", () => {
  it("returns a disconnect() that removes the click interception and is idempotent", () => {
    stubMatchMedia(false);
    const { root, summary } = buildFaqItem(false);
    const disconnect = initFaqAnimation(root);

    disconnect();
    disconnect(); // idempotent, must not throw or double-detach

    const event = dispatchClick(summary);

    expect(event.defaultPrevented).toBe(false);
  });
});
