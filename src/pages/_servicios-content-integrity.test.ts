import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiciosPage from "./servicios.astro";

// Spec: "Content Integrity (No Fabricated Claims)" — full-page scan. Scans
// the complete rendered Servicios page HTML for each of the 5 forbidden
// claim patterns shared with Home's `_index-content-integrity.test.ts`, plus
// the results/outcome-guarantee pattern that the design's content audit
// flagged for the "condiciones contractuales" reword (task 2.1). None may
// appear anywhere in the composed output (Intro, Área jurídica, Área
// financiera, ProcessSteps, FAQ, closing CTA).
describe("servicios.astro (content integrity — no fabricated claims)", () => {
  it("contains none of the forbidden claim patterns anywhere in the full page", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiciosPage, {
      request: new Request("https://alba-abogacia.es/servicios"),
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
    // 6. Results/outcome guarantee claim — confirms task 2.1's mandatory
    // reword ("condiciones contractuales", not "garantías") keeps the page
    // clean against the same pattern `ServiceDetailCard.test.ts` enforces.
    expect(html).not.toMatch(/garant[ií]a/i);
  });
});
