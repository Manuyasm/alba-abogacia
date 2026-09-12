import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiceDetailCard from "./ServiceDetailCard.astro";

// Spec: "ServiceDetailCard Component" — renders title/description/scope
// bullets/CTA from props, with a descriptive per-card CTA link (not a
// whole-card link wrapper). Must not render pricing, fee, or SLA claims.
// Fixture text is clearly fictional placeholder copy, not real service copy.
describe("ServiceDetailCard", () => {
  it("renders title, description, and all scope items as list items with only the minimum required props", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        scopeItems: ["Situación típica uno", "Situación típica dos", "Situación típica tres"],
        ctaLabel: "Consultar sobre el servicio de ejemplo",
        ctaHref: "/contacto",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Servicio de ejemplo");
    expect(html).toContain("Descripción de ejemplo para el servicio ficticio.");
    expect(html).not.toContain("undefined");

    const liMatches = html.match(/<li[\s>]/g) ?? [];
    // 1 outer card <li> + 3 scope-item <li>s.
    expect(liMatches).toHaveLength(4);
    expect(html).toContain("Situación típica uno");
    expect(html).toContain("Situación típica dos");
    expect(html).toContain("Situación típica tres");
  });

  it("renders exactly one CTA link with the given href and label, and different scope items with a different scope count", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Otro servicio",
        description: "Otra descripción ficticia.",
        scopeItems: ["Único caso típico"],
        ctaLabel: "Consultar sobre otro servicio",
        ctaHref: "/contacto",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    const anchorMatches = html.match(/<a[^>]*>/g) ?? [];
    expect(anchorMatches).toHaveLength(1);
    // PR C ("Comprehensive Motion System v2"): the CTA is now an
    // `.arrow-link` with a trailing arrow indicator element, so it no
    // longer closes immediately after the label text.
    expect(html).toMatch(/<a[^>]*href="\/contacto"[^>]*>[\s\S]*Consultar sobre otro servicio[\s\S]*<\/a>/);
    expect(html).toContain("arrow-link-arrow");

    const liMatches = html.match(/<li[\s>]/g) ?? [];
    // 1 outer card <li> + 1 scope-item <li> (different count than the first test).
    expect(liMatches).toHaveLength(2);
  });

  // PR C: the whole card lifts/gains a red border/shadow on hover
  // (hover-capable devices only), matching `ServiceCard.astro`'s pattern.
  it("carries the .service-card hover class on the outer card", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        scopeItems: ["Situación típica uno"],
        ctaLabel: "Consultar sobre el servicio",
        ctaHref: "/contacto",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<li class="[^"]*\bservice-card\b[^"]*"/);
  });

  it("contains no pricing, fee, or SLA/time-bound claims", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        scopeItems: ["Situación típica uno"],
        ctaLabel: "Consultar sobre el servicio",
        ctaHref: "/contacto",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).not.toMatch(/\d+\s*(horas?|d[ií]as?)/i);
    expect(html).not.toMatch(/presupuesto cerrado/i);
    expect(html).not.toMatch(/garant[ií]a/i);
    expect(html).not.toMatch(/€|precio|tarifa|honorarios/i);
  });
});
