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

  // PR C ("Comprehensive Motion System v2"): the hover lift/border/shadow
  // interaction only makes sense on a clickable card, so `.service-card`
  // and its arrow indicator are only present when `href` is supplied.
  it("carries the .service-card hover class and an arrow indicator only when href is supplied", async () => {
    const container = await AstroContainer.create();
    const withHref = await container.renderToString(ServiceCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        href: "/servicios/ejemplo",
      },
      request: new Request("https://alba-abogacia.es/"),
    });
    const withoutHref = await container.renderToString(ServiceCard, {
      props: {
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(withHref).toMatch(/<a[^>]*class="[^"]*\bservice-card\b[^"]*"/);
    expect(withHref).toContain("service-card-arrow");
    expect(withoutHref).not.toContain("service-card");
  });

  // PR C: the icon gets a dedicated hover-background wrapper, but only when
  // an icon is actually supplied (no icon prop → nothing to wrap).
  it("wraps a supplied icon in .service-card-icon-bg", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: {
        icon: "⚖️",
        title: "Servicio de ejemplo",
        description: "Descripción de ejemplo para el servicio ficticio.",
        href: "/servicios/ejemplo",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/class="service-card-icon-bg[^"]*"/);
  });
});
