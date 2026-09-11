import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ElDespachoPage from "./el-despacho.astro";
import TeamTeaser from "@/components/home/TeamTeaser.astro";

// Spec: "Page Existence", "Philosophy/Intro Section", "Team Profiles",
// "Offices Section", "El Despacho FAQ", "Closing CTA", "Accessibility and
// Navigation State". Design: flat static page, 5 sections (Intro/Philosophy,
// Team, Offices, FAQ, closing CTA) built on `TeamCard`, `OfficeCard`, and a
// page-local `FaqAccordion`, no `ProcessSteps` (design's deliberate
// omission). Renders the real composed page and asserts section order,
// heading hierarchy, team/office/FAQ content, the closing CTA, and the
// team taxonomy match against Home's `TeamTeaser.astro`.
describe("el-despacho.astro (page composition)", () => {
  async function renderElDespacho(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(ElDespachoPage, {
      request: new Request("https://alba-abogacia.es/el-despacho"),
    });
  }

  it("exposes the #main-content landmark for the skip-link contract", async () => {
    const html = await renderElDespacho();

    expect(html).toMatch(/<main[^>]*id="main-content"/);
  });

  it("renders exactly one <h1> for the whole page", async () => {
    const html = await renderElDespacho();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("renders sections in order: Intro, Equipo, Oficinas, FAQ, CTA", async () => {
    const html = await renderElDespacho();

    const introIndex = html.indexOf("Quiénes somos");
    const teamIndex = html.indexOf("El equipo");
    const officesIndex = html.indexOf("Dónde estamos");
    const faqIndex = html.indexOf("Preguntas frecuentes");
    const ctaIndex = html.indexOf("Hablemos de su situación");

    expect(introIndex).toBeGreaterThan(-1);
    expect(teamIndex).toBeGreaterThan(introIndex);
    expect(officesIndex).toBeGreaterThan(teamIndex);
    expect(faqIndex).toBeGreaterThan(officesIndex);
    expect(ctaIndex).toBeGreaterThan(faqIndex);
  });

  it("renders exactly one <h2> per major section (Equipo, Oficinas, FAQ, CTA)", async () => {
    const html = await renderElDespacho();

    // 4 major sections beyond the intro's <h1>: El equipo, Dónde estamos,
    // Preguntas frecuentes, Hablemos de su situación.
    expect(html.match(/<h2[ >]/g)).toHaveLength(4);
  });

  it("keeps heading levels in strict hierarchical order with no skipped level", async () => {
    const html = await renderElDespacho();

    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((match) => Number(match[1]));

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      const current = levels[i] as number;
      const previous = levels[i - 1] as number;
      expect(current).toBeLessThanOrEqual(previous + 1);
    }
    // TeamCard's own <h3> (under the "El equipo" <h2>) is the only level-3
    // heading on the page — the philosophy principles use non-heading
    // emphasized text precisely to avoid an h1 -> h3 skip.
    expect(levels.filter((level) => level === 3)).toHaveLength(2);
  });

  it("renders the 4 philosophy principles (Claridad, Confianza, Cercanía, Privacidad)", async () => {
    const html = await renderElDespacho();

    const introStart = html.indexOf("Quiénes somos");
    const teamStart = html.indexOf("El equipo");
    const introSection = html.slice(introStart, teamStart);

    expect(introSection).toContain("Claridad");
    expect(introSection).toContain("Confianza");
    expect(introSection).toContain("Cercanía");
    expect(introSection).toContain("Privacidad");
  });

  it("renders both TeamCards with non-empty bio and the confirmed name/role", async () => {
    const html = await renderElDespacho();

    const teamStart = html.indexOf("El equipo");
    const officesStart = html.indexOf("Dónde estamos");
    const teamSection = html.slice(teamStart, officesStart);

    expect(teamSection).toContain("Verónica Alba Suárez");
    expect(teamSection).toContain("Abogada");
    expect(teamSection).toContain("Aitor Domínguez López");
    expect(teamSection).toContain("Consultor financiero");

    // 2 <p> bio tags rendered by TeamCard's `{bio && <p>{bio}</p>}` branch —
    // confirms `bio` was actually passed and rendered, not omitted.
    const bioParagraphs = teamSection.match(/<p class="text-sm text-muted">/g) ?? [];
    expect(bioParagraphs).toHaveLength(2);
  });

  it("matches TeamTeaser's team taxonomy exactly (name + role), same order", async () => {
    const teaserContainer = await AstroContainer.create();
    const teaserHtml = await teaserContainer.renderToString(TeamTeaser, {
      request: new Request("https://alba-abogacia.es/"),
    });
    const teaserNames = [...teaserHtml.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) =>
      (match[1] as string).trim(),
    );
    const teaserRoles = [...teaserHtml.matchAll(/<p class="text-sm font-medium text-muted">([^<]+)<\/p>/g)].map(
      (match) => (match[1] as string).trim(),
    );

    const html = await renderElDespacho();
    const teamStart = html.indexOf("El equipo");
    const officesStart = html.indexOf("Dónde estamos");
    const teamSection = html.slice(teamStart, officesStart);
    const pageNames = [...teamSection.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) =>
      (match[1] as string).trim(),
    );
    const pageRoles = [...teamSection.matchAll(/<p class="text-sm font-medium text-muted">([^<]+)<\/p>/g)].map(
      (match) => (match[1] as string).trim(),
    );

    expect(pageNames).toEqual(teaserNames);
    expect(pageRoles).toEqual(teaserRoles);
  });

  it("renders both OfficeCards with the confirmed office names and a non-hierarchical mapNote", async () => {
    const html = await renderElDespacho();

    const officesStart = html.indexOf("Dónde estamos");
    const faqStart = html.indexOf("Preguntas frecuentes");
    const officesSection = html.slice(officesStart, faqStart);

    expect(officesSection).toContain("Langreo (Asturias)");
    expect(officesSection).toContain("Madrid");
    const mapNotes = officesSection.match(/Atención presencial y telemática\./g) ?? [];
    expect(mapNotes).toHaveLength(2);
  });

  it("renders a FaqAccordion with 4 details/summary items", async () => {
    const html = await renderElDespacho();

    const faqStart = html.indexOf("Preguntas frecuentes");
    const ctaStart = html.indexOf("Hablemos de su situación");
    const faqSection = html.slice(faqStart, ctaStart);

    expect(faqSection.match(/<details/g)).toHaveLength(4);
    expect(faqSection.match(/<summary/g)).toHaveLength(4);
  });

  it("renders a closing CTA linking to /contacto", async () => {
    const html = await renderElDespacho();

    const ctaStart = html.indexOf("Hablemos de su situación");
    const ctaSection = html.slice(ctaStart);

    expect(ctaSection).toMatch(/<a[^>]*href="\/contacto"[^>]*>\s*Solicitar consulta\s*<\/a>/);
  });
});
