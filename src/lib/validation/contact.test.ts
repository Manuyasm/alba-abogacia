import { describe, expect, it } from "vitest";
import { ContactSchema } from "./contact";

const validPayload = {
  nombre: "Ana García",
  email: "ana@example.com",
  telefono: "+34 600 000 000",
  mensaje: "Necesito asesoramiento en derecho laboral.",
  aceptaPrivacidad: true,
  honeypot: "",
  capToken: "d9256640cb53:challenge:solution",
};

describe("ContactSchema", () => {
  it("accepts a fully valid submission", () => {
    const result = ContactSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
  });

  it("rejects a missing nombre", () => {
    const result = ContactSchema.safeParse({ ...validPayload, nombre: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = ContactSchema.safeParse({ ...validPayload, email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing teléfono", () => {
    const result = ContactSchema.safeParse({ ...validPayload, telefono: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing mensaje", () => {
    const result = ContactSchema.safeParse({ ...validPayload, mensaje: "" });

    expect(result.success).toBe(false);
  });

  it("rejects an unchecked privacy consent", () => {
    const result = ContactSchema.safeParse({ ...validPayload, aceptaPrivacidad: false });

    expect(result.success).toBe(false);
  });

  it("rejects a submission missing the privacy consent field entirely", () => {
    const { aceptaPrivacidad: _omit, ...withoutConsent } = validPayload;
    const result = ContactSchema.safeParse(withoutConsent);

    expect(result.success).toBe(false);
  });

  it("rejects a filled honeypot field", () => {
    const result = ContactSchema.safeParse({ ...validPayload, honeypot: "bot-filled-this" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing Cap token", () => {
    const result = ContactSchema.safeParse({ ...validPayload, capToken: "" });

    expect(result.success).toBe(false);
  });

  it("does not accept the rejected área de consulta / sede / preferencia fields as part of the schema", () => {
    const shape = Object.keys(ContactSchema.shape);

    expect(shape).toEqual([
      "nombre",
      "email",
      "telefono",
      "mensaje",
      "aceptaPrivacidad",
      "honeypot",
      "capToken",
    ]);
  });
});
