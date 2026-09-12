import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer } from "@astrojs/react/container-renderer";
// Astro virtual module — only resolvable under Vite/Vitest (documented
// Container API pattern for pages that mount a framework island). Matches
// `_contacto-page.test.ts`'s established pattern for a page that renders
// `<ContactForm client:idle />`.
import { loadRenderers } from "astro:container";
import { describe, expect, it } from "vitest";
import IndexPage from "./index.astro";
import { OFFICES } from "@/lib/site-facts";

const LANGREO_ADDRESS_LINE = OFFICES.langreo.addressLines[0] as string;
const MADRID_ADDRESS_LINE = OFFICES.madrid.addressLines[0] as string;

// Spec: "Hero Section", "Services Summary", "Team Teaser", "Process Steps",
// "Offices", "FAQ", "Contact Section", "Accessibility and Motion" — full-page
// composition (tasks 3.1). Renders the real composed Home page and asserts
// section order, heading hierarchy, both offices, the FAQ accordion, and that
// the existing `<ContactForm>` island remains present and unregressed.
describe("index.astro (Home page composition)", () => {
  async function renderHome(): Promise<string> {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers });
    return container.renderToString(IndexPage, {
      request: new Request("https://alba-abogacia.es/"),
    });
  }

  it("exposes the #main-content landmark for the skip-link contract", async () => {
    const html = await renderHome();

    expect(html).toMatch(/<main[^>]*id="main-content"/);
  });

  it("renders exactly one <h1> for the whole page", async () => {
    const html = await renderHome();

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("renders sections in order: Hero, ServicesSummary, TeamTeaser, ProcessSteps, Offices, FAQ, Contact", async () => {
    const html = await renderHome();

    const heroIndex = html.indexOf("Asesoramiento jurídico y financiero claro");
    const servicesIndex = html.indexOf("Nuestros servicios");
    const teamIndex = html.indexOf("Quién le atiende");
    const processIndex = html.indexOf("Cómo trabajamos");
    const officesIndex = html.indexOf("Nuestras oficinas");
    const faqIndex = html.indexOf("Preguntas frecuentes");
    const contactIndex = html.indexOf("Solicite su consulta");

    expect(heroIndex).toBeGreaterThan(-1);
    expect(servicesIndex).toBeGreaterThan(heroIndex);
    expect(teamIndex).toBeGreaterThan(servicesIndex);
    expect(processIndex).toBeGreaterThan(teamIndex);
    expect(officesIndex).toBeGreaterThan(processIndex);
    expect(faqIndex).toBeGreaterThan(officesIndex);
    expect(contactIndex).toBeGreaterThan(faqIndex);
  });

  it("renders exactly one <h2> per major section, plus ContactForm's own internal <h2>", async () => {
    const html = await renderHome();

    // 6 major sections (services, team, process, offices, FAQ, contact) each
    // contribute one <h2>, plus ContactForm's own untouched internal <h2>
    // ("Póngase en contacto...", required by its own `aria-labelledby`
    // contract and never modified per design) = 7 total. Hero contributes
    // the page's single <h1>, not an <h2>.
    expect(html.match(/<h2[ >]/g)).toHaveLength(7);
  });

  it("renders both offices, with Madrid showing no phone element", async () => {
    const html = await renderHome();

    expect(html).toContain(LANGREO_ADDRESS_LINE);
    expect(html).toMatch(new RegExp(`href="tel:${OFFICES.langreo.phone}"`));
    expect(html).toContain(MADRID_ADDRESS_LINE);

    const madridCardStart = html.indexOf(MADRID_ADDRESS_LINE);
    const madridCardSection = html.slice(Math.max(0, madridCardStart - 400), madridCardStart + 400);
    expect(madridCardSection).not.toContain("tel:undefined");
    expect(madridCardSection).not.toContain("mailto:undefined");
  });

  // office-map-widget PR2 (task 3.2): the shared map is mounted once, below
  // both OfficeCards, inside the same "Nuestras oficinas" section — not
  // duplicated per card (design's page-mounting decision).
  it("mounts the shared OfficeMap below both OfficeCards, naming both offices in its accessible label", async () => {
    const html = await renderHome();

    const officesStart = html.indexOf("Nuestras oficinas");
    const faqStart = html.indexOf("Preguntas frecuentes");
    const officesSection = html.slice(officesStart, faqStart);

    expect(officesSection).toMatch(/role="img"/);
    expect(officesSection).toContain(
      `aria-label="Mapa con la ubicación de: ${OFFICES.langreo.name}, ${OFFICES.madrid.name}"`,
    );

    // The map must come after both OfficeCards, not interleaved between them.
    const secondOfficeCardIndex = officesSection.lastIndexOf(MADRID_ADDRESS_LINE);
    const mapIndex = officesSection.indexOf('role="img"');
    expect(mapIndex).toBeGreaterThan(secondOfficeCardIndex);
  });

  it('still renders both unchanged "Cómo llegar" links alongside the map', async () => {
    const html = await renderHome();

    expect(html).toContain(`aria-label="Cómo llegar a ${OFFICES.langreo.name}"`);
    expect(html).toContain(`aria-label="Cómo llegar a ${OFFICES.madrid.name}"`);
  });

  it("renders a FaqAccordion with 4 details/summary items", async () => {
    const html = await renderHome();

    // Scope to the FAQ section only — `SiteHeader`'s own mobile-nav toggle
    // also renders one unrelated <details>/<summary> pair.
    const faqStart = html.indexOf("Preguntas frecuentes");
    const faqEnd = html.indexOf("Solicite su consulta");
    const faqSection = html.slice(faqStart, faqEnd);

    expect(faqSection.match(/<details/g)).toHaveLength(4);
    expect(faqSection.match(/<summary/g)).toHaveLength(4);
  });

  it("keeps the #contacto section with the ContactForm still present", async () => {
    const html = await renderHome();

    expect(html).toMatch(/<section[^>]*id="contacto"/);
    expect(html).toContain("Solicite su consulta");
    // ContactForm renders a <form> element client-side island root.
    expect(html).toMatch(/<form/);
  });
});
