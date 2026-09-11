/**
 * Provider-agnostic email delivery for the contact form (`POST /api/contacto`).
 *
 * The concrete SMTP/transactional provider is an explicit OPEN ITEM (spec:
 * "SMTP/transactional provider — TBD — pending selection + DPA/EEA-hosting
 * review"). This module defines the `EmailTransport` boundary so
 * `ContactEmailSender` can be unit-tested against a mock transport now, and
 * wired to a real provider later without touching escaping or PII rules.
 *
 * `createUnconfiguredEmailTransport()` is a safe placeholder: it never
 * fabricates a provider or a recipient address, and it always fails through
 * the same generic error path a real provider outage would take — it must
 * never report a fabricated success.
 *
 * PII rule (spec: "PII and Logging Constraints"): this module MUST NEVER log
 * `mensaje` or any raw payload/message content, on either the success or the
 * failure path.
 */

export interface ContactEmailPayload {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Boundary a concrete SMTP/transactional provider adapter must implement. */
export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailSenderConfig {
  /** Sourced from the confirmed `CONTACT_RECIPIENT_EMAIL` env var — never hardcoded/fabricated. */
  recipientEmail: string;
}

export type EmailSendResult = { success: true } | { success: false; reason: "send_failed" };

export interface EmailSender {
  send(payload: ContactEmailPayload): Promise<EmailSendResult>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the internal notification email body. Access to the delivered
 * email is governed by an access/retention policy whose period is an
 * explicit OPEN ITEM (spec: "PII and Logging Constraints") — the
 * `{{RETENTION_PERIOD}}` placeholder below MUST NOT be replaced with an
 * invented duration.
 */
function renderEmailHtml(payload: ContactEmailPayload): string {
  return [
    "<p><strong>Nombre:</strong> " + escapeHtml(payload.nombre) + "</p>",
    "<p><strong>Email:</strong> " + escapeHtml(payload.email) + "</p>",
    "<p><strong>Teléfono:</strong> " + escapeHtml(payload.telefono) + "</p>",
    "<p><strong>Mensaje:</strong> " + escapeHtml(payload.mensaje) + "</p>",
    "<!-- Política de acceso y retención: {{RETENTION_PERIOD}} (OPEN ITEM, no inventar) -->",
  ].join("\n");
}

function renderEmailText(payload: ContactEmailPayload): string {
  return [
    `Nombre: ${payload.nombre}`,
    `Email: ${payload.email}`,
    `Teléfono: ${payload.telefono}`,
    `Mensaje: ${payload.mensaje}`,
  ].join("\n");
}

export class ContactEmailSender implements EmailSender {
  constructor(
    private readonly transport: EmailTransport,
    private readonly config: EmailSenderConfig,
  ) {}

  async send(payload: ContactEmailPayload): Promise<EmailSendResult> {
    const message: EmailMessage = {
      to: this.config.recipientEmail,
      subject: "Nuevo mensaje de contacto — ALBA Abogacía",
      html: renderEmailHtml(payload),
      text: renderEmailText(payload),
    };

    try {
      await this.transport.send(message);
      return { success: true };
    } catch {
      // Never log `payload` or `message` here — both may contain `mensaje`.
      return { success: false, reason: "send_failed" };
    }
  }
}

/**
 * Safe placeholder transport used until the SMTP/transactional provider OPEN
 * ITEM resolves. It never delivers anything and never fabricates a provider;
 * it always rejects so `ContactEmailSender.send` reports the same generic
 * `send_failed` a real provider outage would produce.
 */
export function createUnconfiguredEmailTransport(): EmailTransport {
  return {
    async send(): Promise<void> {
      throw new Error(
        "Email transport not configured: select and wire an SMTP/transactional provider (see spec Open Items).",
      );
    },
  };
}

/**
 * Always-succeeding, never-delivers-anywhere test double. Exists solely so
 * PR5's E2E suite can exercise the real `POST /api/contacto` pipeline through
 * to a genuine client-side success state against a live self-hosted Cap
 * instance, without fabricating a real SMTP/transactional provider (still an
 * explicit OPEN ITEM — see spec "Open Items"). Selected only by
 * `resolveEmailTransport` in `src/pages/api/contacto.ts` when
 * `CONTACT_EMAIL_TEST_MODE` is exactly `"true"`; every other value — unset,
 * empty, or anything else — keeps the safe `createUnconfiguredEmailTransport`
 * default. Never enable this flag in production.
 */
export function createTestEmailTransport(): EmailTransport {
  return {
    async send(): Promise<void> {
      // Intentionally a no-op: never contacts a real provider, never logs
      // the message (PII rule), always resolves so the route can be
      // end-to-end tested up to a genuine success response.
    },
  };
}
