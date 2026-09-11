import { describe, expect, it } from "vitest";
import { BRAND_NAME, OFFICES, PRIMARY_EMAIL, SITE_NAME } from "./site-facts";

// Confirmed facts per Engram memory #2643 (client chat, 2026-09-10). Madrid's
// address is confirmed but its phone/email are not — this module MUST NOT
// fabricate them.
describe("site-facts", () => {
  it("exposes full confirmed contact details for the Langreo office", () => {
    expect(OFFICES.langreo.addressLines).toEqual([
      "C/ Inventor La Cierva, nº 22, 1º A, C.P. 33930, Langreo, Principado de Asturias",
    ]);
    expect(OFFICES.langreo.phone).toBe("985694493");
    expect(OFFICES.langreo.email).toBe("info@alba-abogacia.es");
  });

  it("exposes only the confirmed address for the Madrid office, no phone or email", () => {
    expect(OFFICES.madrid.addressLines).toEqual(["C/ Bravo Murillo, nº 377, 2º, Madrid"]);
    expect(OFFICES.madrid.phone).toBeUndefined();
    expect(OFFICES.madrid.email).toBeUndefined();
  });

  it("exposes distinct SITE_NAME (full branding) and BRAND_NAME (JSON-LD-safe short form)", () => {
    expect(SITE_NAME).toBe("ALBA Abogacía & Consulting");
    expect(BRAND_NAME).toBe("Alba Abogacía");
  });

  it("exposes the confirmed primary contact email, matching the Langreo office email", () => {
    expect(PRIMARY_EMAIL).toBe("info@alba-abogacia.es");
    expect(OFFICES.langreo.email).toBe(PRIMARY_EMAIL);
  });
});
