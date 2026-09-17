import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Hero from "./Hero.astro";

// Spec: "Hero Section" — real Spanish headline/subheadline, dual CTA
// (`#contacto` anchor + `/servicios` link), and no fabricated stats or
// stock/placeholder imagery. Pattern mirrors `SiteHeader.test.ts` (PR2):
// Astro Container renders the real markup to an HTML string.
describe("Hero", () => {
  it("renders exactly one h1 with the real headline", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const h1Matches = html.match(/<h1[\s>]/g) ?? [];
    expect(h1Matches).toHaveLength(1);
    expect(html).toContain("Asesoramiento jurídico y financiero claro, en Asturias y Madrid");
  });

  it("renders a CTA anchoring to #contacto and a CTA linking to /servicios", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="#contacto"[^>]*>/);
    expect(html).toMatch(/<a[^>]*href="\/servicios"[^>]*>/);
  });

  it("contains no fabricated numeric stat claims", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    // Strip <img> tags first: the optimized `astro:assets` URL contains
    // percent-encoded query params (e.g. "...512%26origHeight...") whose
    // digit-then-"%" byte sequences are encoding artifacts, not a rendered
    // percentage stat claim in visible copy.
    const htmlWithoutImageTags = html.replace(/<img[^>]*>/gi, "");

    // No "<digits>% " / "<digits> años" style stat pattern.
    expect(htmlWithoutImageTags).not.toMatch(/\d+\s*%/);
    expect(htmlWithoutImageTags).not.toMatch(/\d+\s*años/i);
  });

  // PR C ("Comprehensive Motion System v2"): the hero now wires in the
  // honest, generic placeholder photo landed in PR A (design decision #2/#3
  // — no real-person/real-place claim, must stay a single honestly-labeled
  // photo, not a fabricated stock/stat visual). The decorative logo-icon
  // image preceding the <h1> (alt="") is a real brand asset, not a stock
  // photo — excluded from this count on purpose.
  it("renders exactly one honestly-labeled placeholder photo, no real-place/person claim", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    const imgMatches = html.match(/<img[^>]*>/g) ?? [];
    // astro:assets' <Image> renders an empty `alt=""` as a bare `alt`
    // attribute (no `=""`), so a non-empty-alt match is what actually
    // distinguishes the photo from the decorative logo icon here.
    const photoMatches = imgMatches.filter((img) => /\balt="[^"]+"/.test(img));
    expect(photoMatches).toHaveLength(1);
    expect(photoMatches[0]).toContain(
      'alt="Fotografía genérica de un despacho, usada como imagen provisional."',
    );
  });

  // PR C: entrance fires on page LOAD, not on scroll — a dedicated CSS
  // `animation` sequence (`.hero-stagger`/`.hero-photo` in global.css), not
  // the IntersectionObserver-driven `[data-reveal]` system used elsewhere.
  // Content must exist and be fully visible in the rendered HTML regardless
  // of the animation (no JS-dependent hiding).
  it("wraps the entrance content in a load-triggered stagger sequence and the photo in a zoom animation", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/class="hero-stagger[^"]*"/);
    expect(html).toMatch(/class="[^"]*\bhero-photo\b[^"]*"/);
    // 3 direct entrance children (h1, párrafo, botones): 0/150/300ms delays,
    // each a 600ms animation — total sequence 900ms, within the ≤900ms bound.
    expect(html).toContain("--hero-delay:150ms");
    expect(html).toContain("--hero-delay:300ms");
  });

  // animations-v2 PR E, design decision #8: click-tracking wiring — the
  // "Contactar" CTA carries the `[data-track]` hook `click-tracking.ts` reads.
  it("marks the 'Contactar' CTA with the appointment_click data-track hook", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Hero, {
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html).toMatch(/<a[^>]*href="#contacto"[^>]*data-track="appointment_click"[^>]*>\s*Contactar/);
  });
});
