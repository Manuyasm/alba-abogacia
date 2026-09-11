import { describe, expect, it } from "vitest";
import { checkCsrfPolicy } from "./csrf";

describe("checkCsrfPolicy", () => {
  it("passes by default — no CSRF policy has been decided yet (named-but-inert slot)", () => {
    const request = new Request("https://alba-abogacia.es/api/contacto", { method: "POST" });

    const result = checkCsrfPolicy(request);

    expect(result).toEqual({ ok: true });
  });

  // Triangulation skipped: this slot is intentionally structural (design:
  // "CSRF applicability" is an explicit OPEN ITEM). There is exactly one
  // possible output today — `{ ok: true }` — until a policy is decided; a
  // second case would only duplicate this one.
});
