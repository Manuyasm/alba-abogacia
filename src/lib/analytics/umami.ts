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

export type ContactFormEventName = "contact_form_success" | "contact_form_error";

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
 * Fires a contact-form analytics event for a server-confirmed result. MUST
 * only be called after the server has returned — never optimistically on
 * submit. The event payload never carries form field values or PII: only the
 * event name itself is sent.
 */
export function trackContactFormResult(result: ConfirmedContactFormResult): void {
  if (!loadAnalytics()) {
    return;
  }

  const tracker = (window as unknown as { umami?: UmamiTracker }).umami;
  if (!tracker) {
    return;
  }

  const eventName: ContactFormEventName =
    result.status === "success" ? "contact_form_success" : "contact_form_error";
  tracker.track(eventName);
}
