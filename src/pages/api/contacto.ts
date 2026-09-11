import type { APIContext, APIRoute } from "astro";
import { ContactSchema } from "@/lib/validation/contact";
import {
  verifyCaptchaToken,
  type CaptchaVerifyConfig,
} from "@/lib/captcha/verify";
import {
  ContactEmailSender,
  createTestEmailTransport,
  createUnconfiguredEmailTransport,
  type EmailSender,
  type EmailTransport,
} from "@/lib/email/sender";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit/limiter";
import { checkCsrfPolicy } from "@/lib/security/csrf";

/**
 * `POST /api/contacto` — on-demand route (spec: "contact-form-submission",
 * "captcha-verification", "contact-email-delivery", "analytics-events").
 *
 * Pipeline (fixed order, per this PR's assignment): named CSRF slot (inert,
 * see `src/lib/security/csrf.ts`) → body-size limit → honeypot check →
 * rate limiting → Cap `/siteverify` → `ContactSchema` validation → email
 * send → generic JSON result. The client fires its Umami event from this
 * response's `ok`/not-`ok` status only, never from raw submit (already
 * enforced client-side in PR3's `ContactForm.tsx`).
 *
 * PII rule (spec: "PII and Logging Constraints"): this module MUST NEVER
 * log `mensaje`, or the raw request body, on any path — success, validation
 * failure, or an unexpected exception.
 */

export const prerender = false;

const MAX_BODY_BYTES = 10_000;

export type ContactApiResponseBody =
  | { success: true }
  | {
      success: false;
      code: "VALIDATION" | "CAPTCHA_FAILED" | "RATE_LIMITED" | "SEND_FAILED";
    };

export interface ContactRouteDeps {
  captchaConfig: CaptchaVerifyConfig;
  emailSender: EmailSender;
  rateLimiter: RateLimiter;
  /** Injectable for testing `verifyCaptchaToken`'s own `fetch` call; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

function jsonResponse(body: ContactApiResponseBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Reads the request body as text (enforcing the size limit before ever
 * calling `JSON.parse`) and parses it. Returns `null` for both an oversized
 * body and malformed JSON — callers treat both as a generic validation
 * failure, never distinguishing the two to the client.
 */
async function readJsonBody(request: Request): Promise<unknown | null> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isHoneypotFilled(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !("honeypot" in body)) {
    return false;
  }
  const value = (body as { honeypot?: unknown }).honeypot;
  return typeof value === "string" && value.length > 0;
}

function extractCapToken(body: unknown): string {
  if (typeof body === "object" && body !== null && "capToken" in body) {
    const value = (body as { capToken?: unknown }).capToken;
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

/**
 * `context.clientAddress` is a getter that some adapters/environments throw
 * on when unavailable — never let that crash rate limiting. Falls back to
 * the `x-forwarded-for` header set by the production reverse proxy
 * (Traefik/Dokploy, see docker-compose.yml), then to a shared bucket.
 */
function resolveClientId(context: Pick<APIContext, "request" | "clientAddress">): string {
  let clientAddress: string | undefined;
  try {
    clientAddress = context.clientAddress;
  } catch {
    clientAddress = undefined;
  }
  return clientAddress ?? context.request.headers.get("x-forwarded-for") ?? "unknown";
}

export async function handleContactRequest(
  context: Pick<APIContext, "request" | "clientAddress">,
  deps: ContactRouteDeps,
): Promise<Response> {
  const { request } = context;

  // Named-but-inert CSRF hook point (design: CSRF applicability — OPEN ITEM).
  // Always passes today; kept first so a real policy, once decided, gates
  // the whole pipeline without reordering anything below it.
  const csrf = checkCsrfPolicy(request);
  if (!csrf.ok) {
    return jsonResponse({ success: false, code: "VALIDATION" }, 403);
  }

  const body = await readJsonBody(request);
  if (body === null) {
    return jsonResponse({ success: false, code: "VALIDATION" }, 400);
  }

  if (isHoneypotFilled(body)) {
    // Spec: "silently rejected without revealing the honeypot's existence" —
    // respond exactly like a real success; do not process further.
    return jsonResponse({ success: true }, 200);
  }

  const clientId = resolveClientId(context);
  const rateLimitResult = await deps.rateLimiter.consume(clientId);
  if (!rateLimitResult.allowed) {
    return jsonResponse({ success: false, code: "RATE_LIMITED" }, 429);
  }

  const capToken = extractCapToken(body);
  const captchaResult = await verifyCaptchaToken(capToken, deps.captchaConfig, deps.fetchImpl);
  if (!captchaResult.success) {
    return jsonResponse({ success: false, code: "CAPTCHA_FAILED" }, 400);
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ success: false, code: "VALIDATION" }, 400);
  }

  const { nombre, email, telefono, mensaje } = parsed.data;

  try {
    const sendResult = await deps.emailSender.send({ nombre, email, telefono, mensaje });
    if (!sendResult.success) {
      return jsonResponse({ success: false, code: "SEND_FAILED" }, 502);
    }
  } catch {
    // Never log the caught error, `parsed.data`, or the raw body here — both
    // may contain `mensaje` (PII rule above).
    return jsonResponse({ success: false, code: "SEND_FAILED" }, 502);
  }

  return jsonResponse({ success: true }, 200);
}

/**
 * Selects the email transport for the production route. Defaults to the
 * safe `createUnconfiguredEmailTransport()` placeholder — SMTP/transactional
 * provider selection is still an explicit OPEN ITEM (spec: "Open Items") and
 * this module never fabricates one.
 *
 * `createTestEmailTransport()` is selected ONLY when `CONTACT_EMAIL_TEST_MODE`
 * is exactly `"true"` — a dedicated, explicit, dev/E2E-only opt-in that lets
 * PR5's Playwright suite exercise the real pipeline against a live
 * self-hosted Cap instance through to a genuine success response, without a
 * real SMTP account. Never set this flag in production.
 */
export function resolveEmailTransport(env: { CONTACT_EMAIL_TEST_MODE?: string }): EmailTransport {
  return env.CONTACT_EMAIL_TEST_MODE === "true"
    ? createTestEmailTransport()
    : createUnconfiguredEmailTransport();
}

function createProductionDeps(): ContactRouteDeps {
  return {
    captchaConfig: {
      apiUrl: import.meta.env.CAP_API_URL ?? "",
      siteKey: import.meta.env.PUBLIC_CAP_SITE_KEY ?? "",
      secretKey: import.meta.env.CAP_SECRET_KEY ?? "",
    },
    emailSender: new ContactEmailSender(
      resolveEmailTransport({ CONTACT_EMAIL_TEST_MODE: import.meta.env.CONTACT_EMAIL_TEST_MODE }),
      { recipientEmail: import.meta.env.CONTACT_RECIPIENT_EMAIL ?? "" },
    ),
    rateLimiter: createRateLimiter(),
  };
}

export const POST: APIRoute = (context) => handleContactRequest(context, createProductionDeps());
