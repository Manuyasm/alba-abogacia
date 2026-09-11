import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServicesSummary from "./ServicesSummary.astro";

// Spec: "Services Summary" — 4-6 `ServiceCard`s sourced from DESIGN.md §5's
// confirmed practice-area taxonomy, each linking to plain `/servicios` (no
// anchor fragment).
describe("ServicesSummary", () => {
  it("renders exactly one h2 heading", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServicesSummary, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h2Matches = html.match(/<h2[\s>]/g) ?? [];
    expect(h2Matches).toHaveLength(1);
  });

  it("renders 6 ServiceCard instances (6 h3 titles) from the confirmed taxonomy", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServicesSummary, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h3Matches = html.match(/<h3[\s>]/g) ?? [];
    expect(h3Matches).toHaveLength(6);

    expect(html).toContain("Derecho de familia");
    expect(html).toContain("Herencias y sucesiones");
    expect(html).toContain("Derecho laboral");
    expect(html).toContain("Seguridad Social");
    expect(html).toContain("Contratos y reclamaciones");
    expect(html).toContain("Consultoría financiera");
  });

  it("links every card to exactly /servicios (no anchor fragment)", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServicesSummary, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const hrefMatches = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(hrefMatches).toHaveLength(6);
    for (const href of hrefMatches) {
      expect(href).toBe("/servicios");
    }
  });
});
