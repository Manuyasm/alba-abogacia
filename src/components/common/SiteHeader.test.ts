import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import SiteHeader from "./SiteHeader.astro";

// Uses the same Astro Container pattern established by
// `src/layouts/BaseLayout.test.ts` (PR1) — renders the real `.astro` markup
// to an HTML string without a browser, then asserts against the rendered
// output. `Astro.url.pathname` (used for the active-link check) is driven by
// the `request` URL passed to `renderToString`.
describe("SiteHeader", () => {
  it("renders all 4 nav links with the expected hrefs", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/servicios"');
    expect(html).toContain('href="/el-despacho"');
    expect(html).toContain('href="/contacto"');
    expect(html).toContain("Inicio");
    expect(html).toContain("Servicios");
    expect(html).toContain("El despacho");
    expect(html).toContain("Contacto");
  });

  it("marks only the matching link with aria-current=page on the root route", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a href="\/" aria-current="page"[^>]*>\s*Inicio/);
    expect(html).not.toMatch(/<a href="\/servicios" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/el-despacho" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/contacto" aria-current="page"/);
  });

  it("marks only the matching link with aria-current=page on a nested route", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/servicios"),
    });

    expect(html).toMatch(/<a href="\/servicios" aria-current="page"[^>]*>\s*Servicios/);
    expect(html).not.toMatch(/<a href="\/" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/el-despacho" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/contacto" aria-current="page"/);
  });

  it("marks only the El despacho link with aria-current=page on /el-despacho", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/el-despacho"),
    });

    expect(html).toMatch(/<a href="\/el-despacho" aria-current="page"[^>]*>\s*El despacho/);
    expect(html).not.toMatch(/<a href="\/" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/servicios" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/contacto" aria-current="page"/);
  });

  it("exposes a mobile nav disclosure via native details/summary with an accessible label", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<details[^>]*>[\s\S]*<summary[^>]*aria-label="Abrir menú"[^>]*>/);
    expect(html).toContain('aria-label="Principal (móvil)"');
  });

  // Design decision #3 (animations-v2): real client logo via `astro:assets`
  // `<Image>`, never hotlinked to the Stitch mockup's Google CDN.
  it("renders the real logo via astro:assets, never hotlinked to an external host", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<img[^>]*alt="ALBA Abogacía &amp; Consulting"/);
    expect(html).not.toContain("googleusercontent");
    expect(html).not.toContain("aida-public");
  });

  // Design decision #7 (animations-v2, "Header compaction"): the header is
  // sticky and never hidden, and a persistent desktop CTA stays reachable at
  // all scroll positions.
  it("carries the sticky-header hook and a persistent desktop 'Solicitar consulta' CTA", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<header[^>]*data-header[^>]*>/);
    expect(html).toMatch(/<a[^>]*href="\/contacto"[^>]*>\s*Solicitar consulta\s*<\/a>/);
  });

  // animations-v2 PR E, design decision #8: click-tracking wiring — the
  // persistent desktop CTA carries the `[data-track]` hook `click-tracking.ts` reads.
  it("marks the desktop 'Solicitar consulta' CTA with the appointment_click data-track hook", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteHeader, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="\/contacto"[^>]*data-track="appointment_click"[^>]*>\s*Solicitar consulta/);
  });
});
