import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer } from "@astrojs/react/container-renderer";
// Astro virtual module — only resolvable under Vite/Vitest (documented
// Container API pattern for pages that mount a framework island). Needed
// since this page's `OfficeCard`s each mount their own
// `<OfficeMap client:visible />` React island.
import { loadRenderers } from "astro:container";
import { describe, expect, it } from "vitest";
import ElDespachoPage from "./el-despacho.astro";

// Spec: "Content Integrity (No Fabricated Claims)", "No Garantías/Credential-
// Status Section". Full-page scan of the composed `/el-despacho` HTML for
// every forbidden pattern this page's source Stitch mockup uniquely
// introduced (years-of-experience, the 3 known-fabricated colegiada numbers,
// "100% independencia", fee/SLA claims, "sede principal/corporativa"
// hierarchy framing, and any Garantías/RC-insurance/colegiación-activa/
// formación-continua phrasing) — mirrors the discipline of
// `_servicios-content-integrity.test.ts`, expanded per design's forbidden-
// pattern scan table.
describe("el-despacho.astro (content integrity — no fabricated claims)", () => {
  it("contains none of the forbidden claim patterns anywhere in the full page", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(ElDespachoPage, {
      request: new Request("https://alba-abogacia.es/el-despacho"),
    });

    // 1. Years-of-experience figure (e.g. "20 años de experiencia", "+10 años").
    expect(html).not.toMatch(/\+?\d{1,2}\s*años/i);

    // 2. All 3 known-fabricated colegiada numbers, literal strings.
    expect(html).not.toContain("5812");
    expect(html).not.toContain("112480");
    expect(html).not.toContain("7192");
    // Plus any colegiada-number-style pattern in general.
    expect(html).not.toMatch(/colegiad[oa]\s*(n[uú]mero|n[ºo]\.?|col\.)?\s*\d/i);

    // 3. "100% independencia" superlative claim.
    expect(html).not.toMatch(/100\s*%\s*independen/i);

    // 4. Fee/process/SLA claims.
    expect(html).not.toMatch(/presupuesto cerrado/i);
    expect(html).not.toMatch(/hoja de encargo/i);
    expect(html).not.toMatch(/(menos de|en)\s*24\s*h/i);
    expect(html).not.toMatch(/consulta\s+gratuita/i);

    // 5. "sede principal"/"sede corporativa" hierarchy framing between offices.
    expect(html).not.toMatch(/sede (principal|central|corporativa)/i);

    // 6. Garantías/RC-insurance/colegiación-activa/formación-continua
    // credential-status phrasing (the explicitly declined "Garantías"
    // section, in any softened or generic form).
    expect(html).not.toMatch(/responsabilidad civil/i);
    expect(html).not.toMatch(/colegiaci[oó]n activa/i);
    expect(html).not.toMatch(/formaci[oó]n continua/i);
    expect(html).not.toMatch(/seguro (de )?rc/i);
  });
});
