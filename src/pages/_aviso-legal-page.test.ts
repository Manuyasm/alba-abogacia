import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import AvisoLegalPage from "./aviso-legal.astro";

// Spec: LSSI-CE art. 10 identification duty — distinct from and in addition
// to politica-privacidad.astro's RGPD/LOPDGDD scope. The colegio/número de
// colegiada is a confirmed OPEN ITEM (not published anywhere, including the
// current live site's own Aviso Legal) — asserted as absent/pending here,
// never as a fabricated value.
describe("aviso-legal.astro (LSSI-CE identification notice)", () => {
  async function renderPage(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(AvisoLegalPage, {
      request: new Request("https://alba-abogacia.es/aviso-legal"),
    });
  }

  it("renders a noindex directive while remaining accessible", async () => {
    const html = await renderPage();

    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it("renders exactly one <h1> and identifies the responsible natural person with the confirmed NIF", async () => {
    const html = await renderPage();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("Verónica Alba Suárez");
    expect(html).toContain("76949152F");
  });

  it("includes the confirmed contact email and Langreo domicile", async () => {
    const html = await renderPage();

    expect(html).toContain("info@alba-abogacia.es");
    expect(html).toContain("Langreo");
  });

  it("marks the colegio/número de colegiada as pending, never a fabricated value", async () => {
    const html = await renderPage();

    expect(html).toMatch(/colegio profesional[\s\S]{0,80}pendiente de confirmar/i);
    expect(html).not.toContain("{{");
    // No plausible-looking invented bar-registration digits anywhere in the page.
    expect(html).not.toMatch(/n[uú]mero de colegiad[ao][^<]{0,20}\d/i);
  });

  it("references the LSSI-CE (Ley 34/2002) as the legal basis for this notice", async () => {
    const html = await renderPage();

    expect(html).toMatch(/Ley 34\/2002/);
  });
});
