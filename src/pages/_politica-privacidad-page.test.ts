import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import PoliticaPrivacidadPage from "./politica-privacidad.astro";

// Spec: "Third-Party Service Disclosure" (office-card delta), scenarios
// "Disclosure section present and accurate" and "No fabricated privacy
// claims" (office-map-widget PR2, task 4.1). Asserts the new numbered
// section discloses OpenFreeMap as the tile provider, states IP address is
// sent to OpenFreeMap's servers when the map becomes visible, states no
// cookies/account/API key are required, and never references any other
// third-party map provider (e.g. CARTO).
describe("politica-privacidad.astro (third-party services disclosure)", () => {
  async function renderPage(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(PoliticaPrivacidadPage, {
      request: new Request("https://alba-abogacia.es/politica-privacidad"),
    });
  }

  it("adds a numbered '7. Servicios de terceros' section after the existing 6 sections", async () => {
    const html = await renderPage();

    expect(html).toMatch(/<h2[^>]*>\s*7\.\s*Servicios de terceros\s*<\/h2>/);
    const section6Index = html.indexOf("6. Más información");
    const section7Index = html.indexOf("7. Servicios de terceros");
    expect(section7Index).toBeGreaterThan(section6Index);
  });

  it("names OpenFreeMap as the tile provider and discloses the IP-address transfer on map visibility", async () => {
    const html = await renderPage();

    const section7Index = html.indexOf("7. Servicios de terceros");
    const section7 = html.slice(section7Index);

    expect(section7).toContain("OpenFreeMap");
    expect(section7).toMatch(/direcci[oó]n IP/i);
    expect(section7).toMatch(/visible/i);
  });

  it("states no cookies, no account, and no API key are required, and never mentions CARTO", async () => {
    const html = await renderPage();

    const section7Index = html.indexOf("7. Servicios de terceros");
    const section7 = html.slice(section7Index);

    expect(section7).toMatch(/sin cookies|no (instala|utiliza) cookies/i);
    expect(section7).toMatch(/sin cuenta|no requiere cuenta/i);
    expect(section7).toMatch(/sin clave|no requiere clave/i);
    expect(html).not.toMatch(/carto/i);
  });
});
