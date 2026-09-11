import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiciosPage from "./servicios.astro";
import ServicesSummary from "@/components/home/ServicesSummary.astro";

// Spec: "Page Existence", "Service Taxonomy Consistency", "Two-Section
// Structure", "ProcessSteps Promotion" (servicios-reuse scenario), "Servicios
// FAQ", "Closing CTA", "Accessibility and Navigation State". Renders the real
// composed Servicios page and asserts section order, heading hierarchy, the
// 6-category taxonomy match against Home's `ServicesSummary.astro`, the FAQ
// accordion, the closing CTA, and the nav active-link state.
describe("servicios.astro (page composition)", () => {
  async function renderServicios(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(ServiciosPage, {
      request: new Request("https://alba-abogacia.es/servicios"),
    });
  }

  it("exposes the #main-content landmark for the skip-link contract", async () => {
    const html = await renderServicios();

    expect(html).toMatch(/<main[^>]*id="main-content"/);
  });

  it("renders exactly one <h1> for the whole page", async () => {
    const html = await renderServicios();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("renders sections in order: Intro, Área jurídica, Área financiera, ProcessSteps, FAQ, CTA", async () => {
    const html = await renderServicios();

    const introIndex = html.indexOf("Servicios jurídicos y de consultoría financiera");
    const juridicoIndex = html.indexOf("Área jurídica");
    const financieroIndex = html.indexOf("Área financiera");
    const processIndex = html.indexOf("Cómo trabajamos");
    const faqIndex = html.indexOf("Preguntas frecuentes");
    const ctaIndex = html.indexOf("¿Necesita asesoramiento?");

    expect(introIndex).toBeGreaterThan(-1);
    expect(juridicoIndex).toBeGreaterThan(introIndex);
    expect(financieroIndex).toBeGreaterThan(juridicoIndex);
    expect(processIndex).toBeGreaterThan(financieroIndex);
    expect(faqIndex).toBeGreaterThan(processIndex);
    expect(ctaIndex).toBeGreaterThan(faqIndex);
  });

  it("renders 4 ServiceDetailCards in Área jurídica and 2 in Área financiera", async () => {
    const html = await renderServicios();

    const juridicoStart = html.indexOf('id="area-juridica"');
    const financieroStart = html.indexOf('id="area-financiera"');
    const processStart = html.indexOf("Cómo trabajamos");

    const juridicoSection = html.slice(juridicoStart, financieroStart);
    const financieroSection = html.slice(financieroStart, processStart);

    expect(juridicoSection.match(/<li[^>]*class="flex flex-col gap-3/g)).toHaveLength(4);
    expect(financieroSection.match(/<li[^>]*class="flex flex-col gap-3/g)).toHaveLength(2);

    expect(juridicoSection).toContain("Derecho de familia");
    expect(juridicoSection).toContain("Herencias y sucesiones");
    expect(juridicoSection).toContain("Derecho laboral");
    expect(juridicoSection).toContain("Seguridad Social");
    expect(financieroSection).toContain("Contratos y reclamaciones");
    expect(financieroSection).toContain("Consultoría financiera");
  });

  it("renders exactly one <h2> per major section (Jurídico, Financiero, ProcessSteps, FAQ, CTA)", async () => {
    const html = await renderServicios();

    // 5 major sections beyond the intro's <h1>: Área jurídica, Área
    // financiera, ProcessSteps ("Cómo trabajamos"), FAQ, closing CTA.
    expect(html.match(/<h2[ >]/g)).toHaveLength(5);
  });

  it("renders exactly 3 ProcessSteps, identical copy to Home's promoted component", async () => {
    const html = await renderServicios();

    expect(html).toContain("Consulta inicial");
    expect(html).toContain("Propuesta y estrategia");
    expect(html).toContain("Acompañamiento");
    const stepMatches = html.match(/<h3 class="font-heading text-lg font-semibold text-ink">/g) ?? [];
    // 4 ServiceDetailCard <h3>s (Jurídico) + 2 (Financiero) + 3 (ProcessSteps) = 9.
    expect(stepMatches).toHaveLength(9);
  });

  it("renders a FaqAccordion with 4 details/summary items", async () => {
    const html = await renderServicios();

    const faqStart = html.indexOf("Preguntas frecuentes");
    const faqEnd = html.indexOf("¿Necesita asesoramiento?");
    const faqSection = html.slice(faqStart, faqEnd);

    expect(faqSection.match(/<details/g)).toHaveLength(4);
    expect(faqSection.match(/<summary/g)).toHaveLength(4);
  });

  it("renders a closing CTA linking to /contacto", async () => {
    const html = await renderServicios();

    const ctaStart = html.indexOf("¿Necesita asesoramiento?");
    const ctaSection = html.slice(ctaStart);

    expect(ctaSection).toMatch(/<a[^>]*href="\/contacto"[^>]*>\s*Solicitar consulta\s*<\/a>/);
  });

  it("marks the Servicios nav link (and only that link) as the active route in the header", async () => {
    const html = await renderServicios();

    expect(html).toMatch(/<a href="\/servicios" aria-current="page"[^>]*>\s*Servicios/);
    expect(html).not.toMatch(/<a href="\/" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/el-despacho" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/contacto" aria-current="page"/);
  });

  it("matches Home's ServicesSummary 6-category taxonomy exactly, same order", async () => {
    const summaryContainer = await AstroContainer.create();
    const summaryHtml = await summaryContainer.renderToString(ServicesSummary, {
      request: new Request("https://alba-abogacia.es/"),
    });
    const summaryTitles = [...summaryHtml.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) =>
      (match[1] as string).trim(),
    );

    const html = await renderServicios();
    const juridicoStart = html.indexOf('id="area-juridica"');
    const processStart = html.indexOf("Cómo trabajamos");
    const cardsHtml = html.slice(juridicoStart, processStart);
    const servicioTitles = [...cardsHtml.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) =>
      (match[1] as string).trim(),
    );

    expect(servicioTitles).toEqual(summaryTitles);
  });
});
