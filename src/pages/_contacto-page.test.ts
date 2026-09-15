import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer } from "@astrojs/react/container-renderer";
// Astro virtual module — only resolvable under Vite/Vitest (documented
// Container API pattern for pages that mount a framework island).
import { loadRenderers } from "astro:container";
import { describe, expect, it } from "vitest";
import ContactoPage from "./contacto.astro";
import { OFFICES } from "@/lib/site-facts";

// Regression guard (tasks Phase 5, 5.4): `contacto.astro` used to declare its
// own local `OFFICE_ADDRESS_LANGREO`/`OFFICE_PHONE` constants; this test
// asserts the rendered address/phone are unchanged after retrofitting the
// page to import `OFFICES.langreo` from `site-facts.ts` instead, and that the
// page finally exposes the `#main-content` landmark the skip-link (PR1) has
// targeted since it was introduced. The page also mounts `<ContactForm
// client:idle />` (a React island), so the container needs the React
// renderer loaded via Astro's documented `astro:container` +
// `@astrojs/react/container-renderer` pattern — otherwise container renders
// fail with `NoMatchingRenderer`.
describe("contacto.astro", () => {
  it("renders the confirmed Langreo address and phone via site-facts.ts", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(ContactoPage, {
      request: new Request("https://alba-abogacia.es/contacto"),
    });

    expect(html).toContain(OFFICES.langreo.addressLines[0]);
    expect(html).toContain(OFFICES.langreo.phone as string);
  });

  it("exposes a #main-content landmark for the skip-link contract", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(ContactoPage, {
      request: new Request("https://alba-abogacia.es/contacto"),
    });

    expect(html).toMatch(/<main[^>]*id="main-content"/);
  });

  it("renders the approved description, production canonical URL, and remains indexable", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(ContactoPage, {
      request: new Request("https://alba-abogacia.es/contacto"),
    });

    expect(html).toContain(
      '<meta name="description" content="Información de contacto de ALBA Abogacía &amp; Consulting en Langreo (Asturias).">',
    );
    expect(html).toContain('<link rel="canonical" href="https://alba-abogacia.es/contacto">');
    expect(html).not.toContain('<meta name="robots" content="noindex">');
  });

  // animations-v2 PR E, design decision #8: click-tracking wiring.
  it("marks the phone link with the phone_click data-track hook", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(ContactoPage, {
      request: new Request("https://alba-abogacia.es/contacto"),
    });

    expect(html).toMatch(/href="tel:[^"]*"[^>]*data-track="phone_click"/);
  });
});
