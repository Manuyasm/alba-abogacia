import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import BaseLayout from "./BaseLayout.astro";

// First `.astro` component test in the repo — uses Astro's experimental
// Container API (`astro/container`, available since Astro 7) to render the
// component to an HTML string without a browser or jsdom. Assertions read
// the real rendered markup, matching this project's "no CSS-class-only,
// behavior-visible" assertion convention from other test files.
describe("BaseLayout", () => {
  it("applies site-wide meta defaults when no optional props are supplied", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Página de prueba" },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<meta name="description" content="Despacho de abogacía[^"]*"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/alba-abogacia\.es\/"\s*\/?>/);
    expect(html).not.toContain('property="og:image"');
    expect(html).not.toContain('<meta name="robots" content="noindex">');
  });

  it("emits a server-rendered noindex directive only when requested", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Borrador", noindex: true },
      request: new Request("https://alba-abogacia.es/borrador"),
    });

    expect(html.match(/<meta name="robots" content="noindex">/g)).toHaveLength(1);
  });

  it("lets a page override description, canonicalUrl and ogImage", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: {
        title: "Servicios",
        description: "Descripción específica de la página de servicios.",
        canonicalUrl: "https://alba-abogacia.es/servicios",
        ogImage: "https://alba-abogacia.es/og/servicios.jpg",
      },
      request: new Request("https://alba-abogacia.es/servicios"),
    });

    expect(html).toContain(
      '<meta name="description" content="Descripción específica de la página de servicios.">',
    );
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/alba-abogacia\.es\/servicios"\s*\/?>/,
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://alba-abogacia.es/og/servicios.jpg">',
    );
  });

  it("renders a skip link that is visually hidden until focus and targets #main-content", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Página de prueba" },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="#main-content"[^>]*class="[^"]*sr-only[^"]*"[^>]*>/);
    expect(html).toMatch(/<a[^>]*class="[^"]*focus:not-sr-only[^"]*"[^>]*>\s*Saltar al contenido/);
  });

  it("emits Organization/LegalService JSON-LD with only confirmed fields, no legal name", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Página de prueba" },
      request: new Request("https://alba-abogacia.es/"),
    });

    const match = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s);
    expect(match).not.toBeNull();
    const rawJsonLd = match?.[1] ?? "";
    expect(rawJsonLd).not.toBe("");
    const jsonLd = JSON.parse(rawJsonLd);

    expect(jsonLd.name).toBe("Alba Abogacía");
    expect(jsonLd.telephone).toBe("985694493");
    expect(jsonLd.email).toBe("info@alba-abogacia.es");
    expect(jsonLd.address).toHaveLength(2);
    expect(jsonLd.address[0].streetAddress).toContain("Langreo");
    expect(jsonLd.address[1].streetAddress).toContain("Madrid");
    expect(jsonLd).not.toHaveProperty("legalName");
    expect(html).not.toContain("{{");
  });
});
