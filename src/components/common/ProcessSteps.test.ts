import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ProcessSteps from "./ProcessSteps.astro";

// Spec: "Process Steps" — exactly 3 generic engagement-process steps, with no
// time-bound SLA claims or guarantees.
describe("ProcessSteps", () => {
  it("renders exactly one h2 heading", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProcessSteps, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h2Matches = html.match(/<h2[\s>]/g) ?? [];
    expect(h2Matches).toHaveLength(1);
    expect(html).toContain("Cómo trabajamos");
  });

  it("renders exactly 3 steps, each with its own h3 title", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProcessSteps, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h3Matches = html.match(/<h3[\s>]/g) ?? [];
    expect(h3Matches).toHaveLength(3);

    expect(html).toContain("Consulta inicial");
    expect(html).toContain("Propuesta y estrategia");
    expect(html).toContain("Acompañamiento");
  });

  it("contains no SLA/time-bound or guarantee claims", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProcessSteps, {
      request: new Request("https://alba-abogacia.es/"),
    });

    // No "<digits> horas"/"<digits> días" style response-time SLA pattern.
    expect(html).not.toMatch(/\d+\s*(horas?|d[ií]as?)/i);
    expect(html).not.toMatch(/presupuesto cerrado/i);
    expect(html).not.toMatch(/garant[ií]a/i);
  });
});
