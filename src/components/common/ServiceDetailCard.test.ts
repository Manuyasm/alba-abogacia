import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiceDetailCard from "./ServiceDetailCard.astro";

// Spec: "ServiceDetailCard Component" — renders title/description/CTA from
// props, with a descriptive per-card CTA link (not a whole-card link
// wrapper). Must not render pricing, fee, or SLA claims. Real content
// (including any scope/typical-situations copy) lives with each page's own
// data, not in this component. Fixture text is clearly fictional placeholder
// copy, not real service copy.
describe("ServiceDetailCard", () => {
  it("renders title and description with only the minimum required props", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        ctaLabel: "Consultar sobre el servicio de ejemplo",
        ctaHref: "/contacto",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Servicio de ejemplo");
    expect(html).toContain("Descripción de ejemplo para el servicio ficticio.");
    expect(html).not.toContain("undefined");

    // Exactly 1 <li>: the outer card itself — no scope-item bullets.
    const liMatches = html.match(/<li[\s>]/g) ?? [];
    expect(liMatches).toHaveLength(1);
  });

  it("renders exactly one CTA link with the given href and label", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Otro servicio",
        description: "Otra descripción ficticia.",
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
  });

  // PR C: the whole card lifts/gains a red border/shadow on hover
  // (hover-capable devices only), matching `ServiceCard.astro`'s pattern.
  it("carries the .service-card hover class on the outer card", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceDetailCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
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
