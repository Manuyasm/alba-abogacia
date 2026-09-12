import { trackEvent } from "./umami";

/**
 * Fail-open Umami click-tracking utility (design decision #8, "Umami click
 * events" — generic `trackEvent(name)` + `[data-track]` attribute convention,
 * one module reused across every CTA instead of a per-page inline script).
 *
 * RESOLVED SCOPE (animations-v2 PR E): only `phone_click` / `email_click` /
 * `appointment_click` are wired. `whatsapp_click` (no WhatsApp link exists,
 * number unconfirmed), `office_selection` (rejected by client), and
 * `service_view` (no per-service pages exist) are intentionally NOT
 * implemented — `TRACKED_CLICK_EVENT_NAMES` below is the single source of
 * truth for which `data-track` values this module recognizes; any other
 * value is silently ignored (fail-open, never throws).
 *
 * Exactly one `click` listener is attached per matched `[data-track]`
 * element at init time (never event-delegation on a shared ancestor), so a
 * single click can never fire more than one event — there is no scenario
 * where overlapping listeners or an animation re-triggering the DOM node
 * causes a duplicate `trackEvent()` call.
 */
export const TRACKED_CLICK_EVENT_NAMES = ["phone_click", "email_click", "appointment_click"] as const;

export type ClickTrackedEventName = (typeof TRACKED_CLICK_EVENT_NAMES)[number];

function isTrackedClickEventName(value: string): value is ClickTrackedEventName {
  return (TRACKED_CLICK_EVENT_NAMES as readonly string[]).includes(value);
}

/** No-op disconnect returned from every fail-open early exit, so callers can
 * always treat the return value as a safe, callable teardown function. */
function noopDisconnect(): void {}

export function initClickTracking(root: ParentNode = document): () => void {
  if (typeof window === "undefined") {
    return noopDisconnect;
  }

  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-track]"));

  const listeners: Array<{ element: HTMLElement; handler: () => void }> = [];
  for (const element of elements) {
    const eventName = element.dataset.track;
    if (!eventName || !isTrackedClickEventName(eventName)) {
      continue;
    }
    const handler = () => trackEvent(eventName);
    element.addEventListener("click", handler);
    listeners.push({ element, handler });
  }

  if (listeners.length === 0) {
    return noopDisconnect;
  }

  let disconnected = false;
  return function disconnect() {
    if (disconnected) {
      return;
    }
    disconnected = true;
    for (const { element, handler } of listeners) {
      element.removeEventListener("click", handler);
    }
  };
}

// PR F (design decision #9, "ClientRouter re-init"): this module no longer
// self-invokes on import — see `scroll-reveal.ts`'s matching comment.
// `src/layouts/BaseLayout.astro` is now the sole owner of the init
// lifecycle via `astro:page-load`. This also removes the one real risk of
// duplicate-firing this module previously carried: a second independent
// auto-init source binding a second `click` listener onto the same
// `[data-track]` node would have fired `trackEvent()` twice per click.
