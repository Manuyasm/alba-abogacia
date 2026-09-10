import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { handleContactRequest, type ContactRouteDeps } from "./contacto";
import type { EmailSender } from "@/lib/email/sender";
import type { RateLimiter } from "@/lib/rate-limit/limiter";

/**
 * Integration tests for `POST /api/contacto` (spec: "captcha-verification",
 * "contact-email-delivery", "Rate Limiting and Honeypot", "PII and Logging
 * Constraints"). Cap and email are mocked at the boundary (`ContactRouteDeps`)
 * per this PR's Strict TDD assignment — no real network/SMTP calls are made.
 */

const VALID_PAYLOAD = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "600123456",
  mensaje: "Necesito asesoramiento legal sobre un contrato.",
  aceptaPrivacidad: true,
  honeypot: "",
  capToken: "sitekey:challenge:solution",
};

function buildRequest(body: unknown): Request {
  return new Request("https://alba-abogacia.es/api/contacto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildContext(body: unknown, clientAddress = "203.0.113.10") {
  return { request: buildRequest(body), clientAddress };
}

function createDeps(overrides: Partial<ContactRouteDeps> = {}): {
  deps: ContactRouteDeps;
  emailSender: { send: ReturnType<typeof vi.fn> };
  rateLimiter: { consume: ReturnType<typeof vi.fn> };
  fetchImpl: ReturnType<typeof vi.fn>;
} {
  const emailSender = { send: vi.fn().mockResolvedValue({ success: true }) };
  const rateLimiter = { consume: vi.fn().mockResolvedValue({ allowed: true }) };
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  });

  const deps: ContactRouteDeps = {
    captchaConfig: {
      apiUrl: "https://cap.alba-abogacia.es",
      siteKey: "sitekey",
      secretKey: "secret",
    },
    emailSender: emailSender as unknown as EmailSender,
    rateLimiter: rateLimiter as unknown as RateLimiter,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...overrides,
  };

  return { deps, emailSender, rateLimiter, fetchImpl };
}

describe("POST /api/contacto — handleContactRequest", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("accepts a valid submission, verifies Cap, sends the email, and returns a generic success", async () => {
    const { deps, emailSender, rateLimiter, fetchImpl } = createDeps();

    const response = await handleContactRequest(buildContext(VALID_PAYLOAD), deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "600123456",
      mensaje: "Necesito asesoramiento legal sobre un contrato.",
    });
  });

  it("rejects an invalid email with a generic 400 and never sends an email", async () => {
    const { deps, emailSender } = createDeps();

    const response = await handleContactRequest(
      buildContext({ ...VALID_PAYLOAD, email: "not-an-email" }),
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "VALIDATION" });
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects an unchecked consent checkbox with a generic 400", async () => {
    const { deps, emailSender } = createDeps();

    const response = await handleContactRequest(
      buildContext({ ...VALID_PAYLOAD, aceptaPrivacidad: false }),
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "VALIDATION" });
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("silently accepts a honeypot-filled submission without processing it further", async () => {
    const { deps, emailSender, rateLimiter, fetchImpl } = createDeps();

    const response = await handleContactRequest(
      buildContext({ ...VALID_PAYLOAD, honeypot: "soy-un-bot" }),
      deps,
    );
    const body = await response.json();

    // Spec: "silently rejected without revealing the honeypot's existence" —
    // the response looks exactly like a real success.
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects with a generic 429 once the rate limit is exceeded", async () => {
    const { deps, emailSender, fetchImpl } = createDeps({
      rateLimiter: { consume: vi.fn().mockResolvedValue({ allowed: false }) } as unknown as RateLimiter,
    });

    const response = await handleContactRequest(buildContext(VALID_PAYLOAD), deps);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ success: false, code: "RATE_LIMITED" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects a replayed/invalid Cap token with a generic 400 and never sends an email", async () => {
    const { deps, emailSender, fetchImpl } = createDeps();
    fetchImpl.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: "Token not found" }),
    });

    const response = await handleContactRequest(buildContext(VALID_PAYLOAD), deps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "CAPTCHA_FAILED" });
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects a missing Cap token without calling Cap, with a generic 400", async () => {
    const { deps, fetchImpl, emailSender } = createDeps();

    const response = await handleContactRequest(
      buildContext({ ...VALID_PAYLOAD, capToken: "" }),
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "CAPTCHA_FAILED" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("returns a generic 502 on SMTP/provider failure and sends exactly one attempt (no duplicate)", async () => {
    const failingSend = vi.fn().mockResolvedValue({ success: false, reason: "send_failed" });
    const { deps } = createDeps({
      emailSender: { send: failingSend } as unknown as EmailSender,
    });

    const response = await handleContactRequest(buildContext(VALID_PAYLOAD), deps);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ success: false, code: "SEND_FAILED" });
    expect(failingSend).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 502 if the email transport throws, without leaking the error", async () => {
    const { deps } = createDeps({
      emailSender: { send: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) } as unknown as EmailSender,
    });

    const response = await handleContactRequest(buildContext(VALID_PAYLOAD), deps);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ success: false, code: "SEND_FAILED" });
  });

  it("rejects an oversized request body with a generic 400 before touching Cap or rate limiting", async () => {
    const { deps, fetchImpl, rateLimiter } = createDeps();
    const oversized = { ...VALID_PAYLOAD, mensaje: "x".repeat(20_000) };

    const response = await handleContactRequest(buildContext(oversized), deps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "VALIDATION" });
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with a generic 400", async () => {
    const { deps } = createDeps();
    const context = {
      request: new Request("https://alba-abogacia.es/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not valid json",
      }),
      clientAddress: "203.0.113.10",
    };

    const response = await handleContactRequest(context, deps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, code: "VALIDATION" });
  });

  it("never logs the mensaje content on any success or failure path", async () => {
    const mensaje = "CONTENIDO-CONFIDENCIAL-DEL-MENSAJE";

    const okDeps = createDeps().deps;
    await handleContactRequest(buildContext({ ...VALID_PAYLOAD, mensaje }), okDeps);

    const { deps: failDeps } = createDeps({
      emailSender: { send: vi.fn().mockRejectedValue(new Error("boom")) } as unknown as EmailSender,
    });
    await handleContactRequest(buildContext({ ...VALID_PAYLOAD, mensaje }), failDeps);

    const allLoggedText = [...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]
      .flat()
      .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
      .join(" ");

    expect(allLoggedText).not.toContain(mensaje);
  });
});
