import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Hero from "./Hero.astro";

// Spec: "Hero Section" — real Spanish headline/subheadline, dual CTA
// (`#contacto` anchor + `/servicios` link), and no fabricated stats or
// stock/placeholder imagery. Pattern mirrors `SiteHeader.test.ts` (PR2):
// Astro Container renders the real markup to an HTML string.
describe("Hero", () => {
  it("renders exactly one h1 with the real headline", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h1Matches = html.match(/<h1[\s>]/g) ?? [];
    expect(h1Matches).toHaveLength(1);
    expect(html).toContain("Asesoramiento jurídico y financiero claro, en Asturias y Madrid");
  });

  it("renders a CTA anchoring to #contacto and a CTA linking to /servicios", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="#contacto"[^>]*>/);
    expect(html).toMatch(/<a[^>]*href="\/servicios"[^>]*>/);
  });

  it("contains no fabricated numeric stat claims or images", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    // No "<digits>% " / "<digits> años" style stat pattern.
    expect(html).not.toMatch(/\d+\s*%/);
    expect(html).not.toMatch(/\d+\s*años/i);
    expect(html).not.toMatch(/<img/i);
  });
});
