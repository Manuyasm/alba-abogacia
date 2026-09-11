import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiceCard from "./ServiceCard.astro";

// Spec: "ServiceCard Component" — renders title/description from props with
// an appropriate heading level, and renders correctly with only the minimum
// required props (no `icon`/`href`). Fixture text is clearly fictional
// placeholder copy, not a real practice-area description.
describe("ServiceCard", () => {
  it("renders title and description with only the minimum required props", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Servicio de ejemplo");
    expect(html).toContain("Descripción de ejemplo para el servicio ficticio.");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("<a ");
  });

  it("wraps the card in a link when href is supplied", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        href: "/servicios/ejemplo",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="\/servicios\/ejemplo"/);
  });
});
