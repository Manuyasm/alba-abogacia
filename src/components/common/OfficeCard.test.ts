import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
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
});
