import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import SiteFooter from "./SiteFooter.astro";

// Spec: "Site Footer" — confirmed Langreo contact info only (memory #2643),
// nav links repeated, `/politica-privacidad` link present, no unconfirmed
// data (Madrid address, colegiada number, WhatsApp). Per PR2's resolved
// apply-time scope, the Madrid office is intentionally NOT rendered here at
// all (not even partially): `OfficeCard` — the component that will later
// render either office generically — is PR3's job, so this footer renders
// the Langreo office directly from `site-facts.ts` only.
describe("SiteFooter", () => {
  it("renders the confirmed Langreo office contact info", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteFooter, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("C/ Inventor La Cierva");
    expect(html).toContain("985694493");
    expect(html).toContain("info@alba-abogacia.es");
  });

  it("does not render the Madrid office, colegiada number, or WhatsApp content", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteFooter, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).not.toContain("Bravo Murillo");
    expect(html).not.toContain("Madrid");
    expect(html).not.toContain("Colegiada");
    expect(html).not.toContain("WhatsApp");
  });

  it("repeats the 4 nav links and links to the privacy policy", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SiteFooter, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/servicios"');
    expect(html).toContain('href="/el-despacho"');
    expect(html).toContain('href="/contacto"');
    expect(html).toContain('href="/politica-privacidad"');
  });
});
