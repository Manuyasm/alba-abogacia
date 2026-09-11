import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import TeamCard from "./TeamCard.astro";

// Spec: "TeamCard Component" — renders name/role with an appropriate heading
// level for the name, and (since no real team photos exist yet) always
// renders a safe initials placeholder with no broken <img>/missing alt text.
// Fixture below is a clearly fictional placeholder person, not a real member
// of the firm.
describe("TeamCard", () => {
  it("renders name and role with a safe placeholder avatar, no broken image", async () => {
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
});
