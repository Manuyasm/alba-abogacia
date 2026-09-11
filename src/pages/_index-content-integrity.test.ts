import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer } from "@astrojs/react/container-renderer";
import { loadRenderers } from "astro:container";
import { describe, expect, it } from "vitest";
import IndexPage from "./index.astro";

// Spec: "Content Integrity (No Fabricated Claims)" — full-page scan (tasks
// 3.2). Scans the complete rendered Home page HTML for each of the 5
// forbidden claim patterns; none may appear anywhere in the composed output
// (Hero, ServicesSummary, TeamTeaser, ProcessSteps, Offices, FAQ, Contact).
describe("index.astro (content integrity — no fabricated claims)", () => {
  it("contains none of the 5 forbidden claim patterns anywhere in the full page", async () => {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    const html = await container.renderToString(IndexPage, {
      request: new Request("https://alba-abogacia.es/"),
    });

    // 1. Years-of-experience stat (e.g. "20 años de experiencia").
    expect(html).not.toMatch(/\d+\s*años?\s+de\s+experiencia/i);
    // 2. Response-time SLA claim (digit + horas/días).
    expect(html).not.toMatch(/\d+\s*(horas?|d[ií]as?)/i);
    // 3. "Consulta gratuita" claim.
    expect(html).not.toMatch(/consulta\s+gratuita/i);
    // 4. Colegiada/credential number.
    expect(html).not.toMatch(/colegiad[oa]\s*(n[uú]mero|nº|#)?\s*\d/i);
    // 5. WhatsApp reference.
    expect(html).not.toMatch(/whatsapp|wa\.me/i);
  });
});
