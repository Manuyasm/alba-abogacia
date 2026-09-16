import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import TeamTeaser from "./TeamTeaser.astro";

// Spec: "Team Teaser" — a `TeamCard` per confirmed team member with name and
// generic role only (no bio, no photo), linking the teaser to `/el-despacho`.
// Team names/roles (Verónica Alba Suárez — Abogada; Aitor Domínguez López —
// Asesor financiero) are explicitly user-authorized for this change.
describe("TeamTeaser", () => {
  it("renders exactly one h2 heading", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamTeaser, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h2Matches = html.match(/<h2[\s>]/g) ?? [];
    expect(h2Matches).toHaveLength(1);
    expect(html).toContain("Quién le atiende");
  });

  it("renders exactly 2 TeamCard instances with the confirmed names and roles", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamTeaser, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h3Matches = html.match(/<h3[\s>]/g) ?? [];
    expect(h3Matches).toHaveLength(2);

    expect(html).toContain("Verónica Alba Suárez");
    expect(html).toContain("Abogada");
    expect(html).toContain("Aitor Domínguez López");
    expect(html).toContain("Asesor financiero");
  });

  it("renders no bio text and no images for either card", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamTeaser, {
      request: new Request("https://alba-abogacia.es/"),
    });

    // TeamCard only ever renders a role <p> unless a `bio` prop is passed;
    // 2 cards with no bio means exactly 2 <p> tags total.
    const pMatches = html.match(/<p[\s>]/g) ?? [];
    expect(pMatches).toHaveLength(2);
    expect(html).not.toMatch(/<img/i);
  });

  it("renders a link to /el-despacho", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TeamTeaser, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="\/el-despacho"[^>]*>/);
  });
});
