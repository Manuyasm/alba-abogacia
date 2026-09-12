import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { OFFICES } from "../../lib/site-facts";
import OfficeCard from "./OfficeCard.astro";

// Spec: "OfficeCard Component" — renders address, phone, and email from
// props, supporting either office shape (with or without a confirmed phone)
// without hardcoding either one's data. Fixture data below is clearly
// fictional placeholder office data, deliberately distinct from the real
// confirmed Langreo/Madrid facts in `site-facts.ts` (no real client data in
// this component's own unit tests — it must stay data-agnostic).
describe("OfficeCard", () => {
  it("renders address, phone, and email when all are supplied", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: {
        name: "Oficina de ejemplo",
        addressLines: ["Calle Ficticia, nº 1, Ciudad Ejemplo"],
        phone: "600000000",
        phoneHref: "tel:600000000",
        email: "ejemplo@ejemplo-ficticio.test",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Oficina de ejemplo");
    expect(html).toContain("Calle Ficticia, nº 1, Ciudad Ejemplo");
    expect(html).toContain("600000000");
    expect(html).toMatch(/href="tel:600000000"/);
    expect(html).toMatch(/href="mailto:ejemplo@ejemplo-ficticio\.test"/);
  });

  // animations-v2 PR E, design decision #8: click-tracking wiring — phone
  // and email links carry the `[data-track]` hook `click-tracking.ts` reads.
  it("marks the phone and email links with the click-tracking data-track hooks", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: {
        name: "Oficina de ejemplo",
        addressLines: ["Calle Ficticia, nº 1, Ciudad Ejemplo"],
        phone: "600000000",
        phoneHref: "tel:600000000",
        email: "ejemplo@ejemplo-ficticio.test",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/href="tel:600000000"[^>]*data-track="phone_click"/);
    expect(html).toMatch(/href="mailto:ejemplo@ejemplo-ficticio\.test"[^>]*data-track="email_click"/);
  });

  it("renders correctly with no phone or email supplied, with no broken markup", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: {
        name: "Oficina secundaria de ejemplo",
        addressLines: ["Avenida Ficticia, nº 2, Otra Ciudad Ejemplo"],
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Oficina secundaria de ejemplo");
    expect(html).toContain("Avenida Ficticia, nº 2, Otra Ciudad Ejemplo");
    expect(html).not.toContain("tel:undefined");
    expect(html).not.toContain("mailto:undefined");
    expect(html).not.toContain("undefined");
  });

  // office-map: "Cómo llegar" directions link-out. Real Langreo/Madrid facts
  // are used here (unlike this component's other fixture-based tests)
  // because these assertions verify correct encoding of the actual
  // production addresses end-to-end, matching the `site-facts.ts` real-data
  // test pattern already used elsewhere for facts consumers.
  it("renders a correctly encoded Google Maps href for Langreo", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.langreo },
      request: new Request("https://alba-abogacia.es/"),
    });

    const expectedHref =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent([OFFICES.langreo.name, ...OFFICES.langreo.addressLines].join(", "));

    // Astro serializes attribute values as valid HTML, so the literal `&`
    // is escaped to `&amp;` in the rendered markup.
    expect(html).toContain(`href="${expectedHref.replace("&", "&amp;")}"`);
  });

  it("renders a correctly encoded Google Maps href for Madrid", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.madrid },
      request: new Request("https://alba-abogacia.es/"),
    });

    const expectedHref =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent([OFFICES.madrid.name, ...OFFICES.madrid.addressLines].join(", "));

    // RFC3986-unreserved chars (`.`, `(`, `)`) stay unescaped while `º`,
    // commas, spaces, and `/` are percent-encoded by `encodeURIComponent`.
    expect(expectedHref).toBe(
      "https://www.google.com/maps/search/?api=1&query=Madrid%2C%20C%2F%20Bravo%20Murillo%2C%20n%C2%BA%20377%2C%202%C2%BA%2C%20Madrid",
    );
    // Astro serializes attribute values as valid HTML, so the literal `&`
    // is escaped to `&amp;` in the rendered markup.
    expect(html).toContain(`href="${expectedHref.replace("&", "&amp;")}"`);
  });

  it("marks the maps link with target=_blank and rel=noopener noreferrer on both office fixtures", async () => {
    const container = await AstroContainer.create();

    const langreoHtml = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.langreo },
      request: new Request("https://alba-abogacia.es/"),
    });
    const madridHtml = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.madrid },
      request: new Request("https://alba-abogacia.es/"),
    });

    for (const html of [langreoHtml, madridHtml]) {
      expect(html).toMatch(/maps\/search\/\?api=1&(?:amp;)?query=[^"]*"[^>]*target="_blank"/);
      expect(html).toMatch(/maps\/search\/\?api=1&(?:amp;)?query=[^"]*"[^>]*rel="noopener noreferrer"/);
    }
  });

  it("gives the maps link a distinct aria-label per office", async () => {
    const container = await AstroContainer.create();

    const langreoHtml = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.langreo },
      request: new Request("https://alba-abogacia.es/"),
    });
    const madridHtml = await container.renderToString(OfficeCard, {
      props: { ...OFFICES.madrid },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(langreoHtml).toContain('aria-label="Cómo llegar a Langreo (Asturias)"');
    expect(madridHtml).toContain('aria-label="Cómo llegar a Madrid"');
    expect(langreoHtml).not.toContain('aria-label="Cómo llegar a Madrid"');
    expect(madridHtml).not.toContain('aria-label="Cómo llegar a Langreo (Asturias)"');
  });

  it("renders the maps link even with no phone or email supplied, with no broken markup", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(OfficeCard, {
      props: {
        name: "Oficina secundaria de ejemplo",
        addressLines: ["Avenida Ficticia, nº 2, Otra Ciudad Ejemplo"],
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    const expectedHref =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(["Oficina secundaria de ejemplo", "Avenida Ficticia, nº 2, Otra Ciudad Ejemplo"].join(", "));

    // Astro serializes attribute values as valid HTML, so the literal `&`
    // is escaped to `&amp;` in the rendered markup.
    expect(html).toContain(`href="${expectedHref.replace("&", "&amp;")}"`);
    expect(html).not.toContain("undefined");
  });
});
