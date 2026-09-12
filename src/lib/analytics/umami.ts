/**
 * Umami analytics gate and contact-form event firing.
 *
 * Whether Umami requires an explicit consent-banner opt-in before loading is
 * an explicit OPEN ITEM (spec: "Umami consent-banner requirement — TBD —
 * pending Spanish AEPD legal review of deployed config"). `loadAnalytics()`
 * is the single flip point: while `CONSENT_GATE_ENABLED` is `false`, it
 * returns `true` unconditionally (today's behavior — no banner gating). Once
 * legal review resolves the open item, flip that one constant — no other
 * module should reimplement this check.
 */

/** Flip point: set to `true` once a consent banner is confirmed required and wired. */
const CONSENT_GATE_ENABLED = false;

export interface AnalyticsConsent {
  granted: boolean;
}

/**
 * Returns whether Umami analytics may load on this page load.
 *
 * @param consent - Current consent-banner state, if one exists. Ignored while
 *   the gate is disabled.
 * @param gateEnabled - Defaults to the module-level flip point; overridable
 *   only for testing the gated branch before the flip point itself changes.
 */
export function loadAnalytics(
  consent?: AnalyticsConsent,
  gateEnabled: boolean = CONSENT_GATE_ENABLED,
): boolean {
  if (!gateEnabled) {
    return true;
  }
  return consent?.granted === true;
}

export type ContactFormEventName =
  | "contact_form_started"
  | "contact_form_success"
  | "contact_form_error";

/**
 * Click-tracking event names (design decision #8: "Umami click events" —
 * generic `trackEvent(name)` + `[data-track]` attribute convention). Only
 * these three are implemented (animations-v2 PR E resolved scope):
 * `whatsapp_click` (no WhatsApp link exists, number unconfirmed),
 * `office_selection` (rejected by client), and `service_view` (no
 * per-service pages exist) are intentionally NOT part of this union — see
 * `src/lib/analytics/click-tracking.ts`'s `TRACKED_CLICK_EVENT_NAMES`, the
 * single source of truth enforcing this at the `[data-track]` wiring layer.
 */
export type ClickTrackedEventName = "phone_click" | "email_click" | "appointment_click";

/** Every event name this module can fire through the generic `trackEvent()`. */
export type TrackedEventName = ContactFormEventName | ClickTrackedEventName;

/**
 * A server-confirmed contact-form submission outcome. The type itself is the
 * enforcement mechanism for the "post-confirmation only" rule (spec:
 * "Post-Confirmation Umami Event Firing"): callers can only construct this
 * value from an awaited server response, never from the raw submit action.
 */
export type ConfirmedContactFormResult = { status: "success" } | { status: "error" };

interface UmamiTracker {
  track(eventName: string): void;
}

/**
 * Fires a named Umami event with no additional payload. Shared by every
 * caller (contact-form result tracking, click-tracking) so there is exactly
 * one place that checks the analytics consent gate and looks up the tracker
 * — the event payload never carries form field values, PII, or any other
 * property beyond the event name itself.
 */
export function trackEvent(name: TrackedEventName): void {
  if (!loadAnalytics()) {
    return;
  }

  const tracker = (window as unknown as { umami?: UmamiTracker }).umami;
  if (!tracker) {
    return;
  }

  tracker.track(name);
}

/**
 * Fires a contact-form analytics event for a server-confirmed result. MUST
 * only be called after the server has returned — never optimistically on
 * submit.
 */
export function trackContactFormResult(result: ConfirmedContactFormResult): void {
  const eventName: ContactFormEventName =
    result.status === "success" ? "contact_form_success" : "contact_form_error";
  trackEvent(eventName);
}
