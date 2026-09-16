import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ServiciosPage from "./servicios.astro";
import ServicesSummary from "@/components/home/ServicesSummary.astro";

const LEGAL_SERVICES = [
  ["Litigios y Disputas", "Representación en tribunales y resolución de conflictos para proteger sus intereses."],
  ["Derecho Corporativo", "Asesoramiento en la formación, gobernanza y operación de empresas para asegurar el cumplimiento y la eficiencia."],
  ["Derecho de familia y menores", "Orientación en procesos de conflicto familiar, menores, régimen económico del matrimonio."],
  ["Derecho Laboral", "Asistencia en asuntos laborales, incluyendo negociaciones contractuales y resolución de disputas laborales."],
  ["Derecho hereditario", "Tramitación completa de herencias, incluyendo impuestos y actos notariales."],
] as const;

const FINANCIAL_SERVICES = [
  ["Planificación financiera", "Desarrollo de estrategias financieras a corto y largo plazo para asegurar la estabilidad y el crecimiento."],
  ["Gestión de Riesgos", "Identificación y mitigación de riesgos financieros para proteger su patrimonio."],
  ["Asesoría en Inversiones", "Orientación en la selección y gestión de inversiones para maximizar rendimientos."],
  ["Reestructuración Financiera", "Asistencia en la reorganización de estructuras financieras para mejorar la eficiencia y la rentabilidad."],
  ["Análisis de Viabilidad de Proyectos", "Evaluación de proyectos de inversión para asegurar su viabilidad y rentabilidad."],
] as const;

describe("servicios.astro (page composition)", () => {
  async function renderServicios(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(ServiciosPage, {
      request: new Request("https://alba-abogacia.es/servicios"),
    });
  }

  function sectionBetween(html: string, startId: string, endText: string): string {
    const start = html.indexOf(`id="${startId}"`);
    const end = html.indexOf(endText, start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    return html.slice(start, end);
  }

  function headingsIn(html: string): string[] {
    return [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => (match[1] as string).trim());
  }

  it("exposes the #main-content landmark for the skip-link contract", async () => {
    const html = await renderServicios();

    expect(html).toMatch(/<main[^>]*id="main-content"/);
  });

  it("renders exactly one <h1> for the whole page", async () => {
    const html = await renderServicios();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("renders the confirmed service groups and introductions before the remaining page sections", async () => {
    const html = await renderServicios();

    const introIndex = html.indexOf("Servicios jurídicos y de consultoría financiera");
    const legalIndex = html.indexOf("Asesoría legal");
    const financialIndex = html.indexOf("Consultoría financiera");
    const processIndex = html.indexOf("Cómo trabajamos");
    const faqIndex = html.indexOf("Preguntas frecuentes");
    const ctaIndex = html.indexOf("¿Necesita asesoramiento?");

    expect(html).toContain("Nuestro equipo de abogados expertos está dedicado a proporcionar soluciones legales efectivas y personalizadas para una variedad de necesidades.");
    expect(html).toContain("Ofrecemos servicios de consultoría financiera para ayudarle a gestionar sus recursos de manera eficiente y alcanzar sus objetivos financieros.");
    expect(legalIndex).toBeGreaterThan(introIndex);
    expect(financialIndex).toBeGreaterThan(legalIndex);
    expect(processIndex).toBeGreaterThan(financialIndex);
    expect(faqIndex).toBeGreaterThan(processIndex);
    expect(ctaIndex).toBeGreaterThan(faqIndex);
  });

  it("renders the five confirmed legal specialties in a semantic list and order", async () => {
    const html = await renderServicios();
    const legalSection = sectionBetween(html, "area-juridica", 'id="area-financiera"');

    expect(legalSection.match(/<li[^>]*class="service-card flex/g)).toHaveLength(5);
    expect(headingsIn(legalSection)).toEqual(LEGAL_SERVICES.map(([title]) => title));
    expect(legalSection).not.toContain("Seguridad Social");
    expect(legalSection).not.toContain("Contratos y reclamaciones");
  });

  it("renders each confirmed legal description exactly once", async () => {
    const html = await renderServicios();
    const legalSection = sectionBetween(html, "area-juridica", 'id="area-financiera"');

    for (const [, description] of LEGAL_SERVICES) {
      expect(legalSection.split(description).length - 1).toBe(1);
    }
  });

  it("renders the five confirmed financial specialties in a semantic list and order", async () => {
    const html = await renderServicios();
    const financialSection = sectionBetween(html, "area-financiera", "Cómo trabajamos");

    expect(financialSection.match(/<li[^>]*class="service-card flex/g)).toHaveLength(5);
    expect(headingsIn(financialSection)).toEqual(FINANCIAL_SERVICES.map(([title]) => title));
    expect(financialSection).not.toContain("Seguridad Social");
    expect(financialSection).not.toContain("Contratos y reclamaciones");
  });

  it("renders each confirmed financial description exactly once", async () => {
    const html = await renderServicios();
    const financialSection = sectionBetween(html, "area-financiera", "Cómo trabajamos");

    for (const [, description] of FINANCIAL_SERVICES) {
      expect(financialSection.split(description).length - 1).toBe(1);
    }
  });

  it("does not render unsupported nested scope lists inside detailed cards", async () => {
    const html = await renderServicios();
    const servicesStart = html.indexOf('id="area-juridica"');
    const servicesEnd = html.indexOf("Cómo trabajamos", servicesStart);
    const servicesHtml = html.slice(servicesStart, servicesEnd);

    expect(servicesHtml.match(/<ul/g)).toHaveLength(2);
  });

  it("renders exactly one <h2> per major section", async () => {
    const html = await renderServicios();

    expect(html.match(/<h2[ >]/g)).toHaveLength(5);
  });

  it("renders exactly 3 ProcessSteps after the ten detailed cards", async () => {
    const html = await renderServicios();

    expect(html).toContain("Consulta inicial");
    expect(html).toContain("Propuesta y estrategia");
    expect(html).toContain("Acompañamiento");
    expect(headingsIn(html)).toHaveLength(13);
  });

  it("renders a FaqAccordion with 4 details/summary items", async () => {
    const html = await renderServicios();
    const faqStart = html.indexOf("Preguntas frecuentes");
    const faqEnd = html.indexOf("¿Necesita asesoramiento?", faqStart);
    const faqSection = html.slice(faqStart, faqEnd);

    expect(faqSection.match(/<details/g)).toHaveLength(4);
    expect(faqSection.match(/<summary/g)).toHaveLength(4);
  });

  it("renders a closing CTA linking to /contacto with its tracking hook", async () => {
    const html = await renderServicios();
    const ctaStart = html.indexOf("¿Necesita asesoramiento?");
    const ctaSection = html.slice(ctaStart);

    expect(ctaSection).toMatch(/<a[^>]*href="\/contacto"[^>]*data-track="appointment_click"[^>]*>\s*Solicitar consulta\s*<\/a>/);
  });

  it("marks the Servicios nav link as the active route", async () => {
    const html = await renderServicios();

    expect(html).toMatch(/<a href="\/servicios" aria-current="page"[^>]*>\s*Servicios/);
    expect(html).not.toMatch(/<a href="\/" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/el-despacho" aria-current="page"/);
    expect(html).not.toMatch(/<a href="\/contacto" aria-current="page"/);
  });

  it("preserves the Home summary's independent six-card overview in its current order", async () => {
    const summaryContainer = await AstroContainer.create();
    const summaryHtml = await summaryContainer.renderToString(ServicesSummary, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(headingsIn(summaryHtml)).toEqual([
      "Derecho de familia",
      "Herencias y sucesiones",
      "Derecho laboral",
      "Seguridad Social",
      "Contratos y reclamaciones",
      "Consultoría financiera",
    ]);
  });
});
