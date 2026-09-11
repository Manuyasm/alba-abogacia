/**
 * Named-but-inert CSRF hook point for `POST /api/contacto`.
 *
 * "CSRF applicability to this anonymous/sessionless form" is an explicit
 * design OPEN ITEM (design rev.2: "TBD — pending explicit decision (Cap+
 * SameSite vs. explicit CSRF)"). This module exists so the route has one
 * documented, named place to enforce a CSRF policy once that decision is
 * made — it MUST NOT invent a policy in the meantime. Today it always
 * passes; the route calls it unconditionally so wiring a real check later
 * only means changing this function's body, never the route's pipeline
 * order.
 */

export type CsrfCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Always returns `{ ok: true }` until the CSRF applicability decision above
 * is resolved. The `request` parameter is intentionally unused today — it is
 * accepted now so a future real check does not change this function's
 * signature or its call site in the route.
 */
export function checkCsrfPolicy(request: Request): CsrfCheckResult {
  void request;
  return { ok: true };
}
