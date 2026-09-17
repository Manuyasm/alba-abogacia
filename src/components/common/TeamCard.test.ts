import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import TeamCard from "./TeamCard.astro";
// Generic fictional placeholder image, already used elsewhere in the project
// for exactly this purpose (Hero.astro) — never a real team member's photo
// in this component's own unit tests.
import placeholderPhoto from "@/assets/placeholder/hero.jpg";

// Spec: "TeamCard Component" — renders name/role with an appropriate heading
// level for the name. `photo` is optional: omitted means a safe initials
// placeholder with no broken <img>/missing alt text; supplied means a real
// photo with a real alt. Fixture below is a clearly fictional placeholder
// person, not a real member of the firm.
describe("TeamCard", () => {
  it("renders name and role with a safe placeholder avatar when no photo is supplied", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamCard, {
      props: {
        name: "Persona de Ejemplo",
        role: "Cargo ficticio",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Persona de Ejemplo");
    expect(html).toContain("Cargo ficticio");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('alt=""');
  });

  it("renders correctly with an optional bio", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamCard, {
      props: {
        name: "Persona de Ejemplo",
        role: "Cargo ficticio",
        bio: "Biografía de ejemplo, breve y ficticia.",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toContain("Biografía de ejemplo, breve y ficticia.");
  });

  it("renders the supplied photo with its alt text instead of the initials placeholder", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamCard, {
      props: {
        name: "Persona de Ejemplo",
        role: "Cargo ficticio",
        photo: placeholderPhoto,
        photoAlt: "Fotografía de Persona de Ejemplo",
      },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<img[^>]*alt="Fotografía de Persona de Ejemplo"/);
    // No initials placeholder <span> when a real photo is supplied.
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>\s*PE\s*</);
  });
});
