import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import CookieNotice from "./CookieNotice.astro";

// This is a preventive privacy notice, NOT a cookie-consent gate — the site
// uses no cookies today (see BaseLayout.astro/CookieNotice.astro's own
// rationale comments). Asserts the copy states that honestly, is
// server-rendered `hidden` by default (client-only dismiss-state check
// decides whether to reveal it), and links to the privacy policy — never
// that it fabricates a cookie-acceptance choice.
describe("CookieNotice", () => {
  async function renderNotice(): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(CookieNotice, {
      request: new Request("https://alba-abogacia.es/"),
    });
  }

  it("is hidden by default in its server-rendered markup", async () => {
    const html = await renderNotice();

    expect(html).toMatch(/<div[^>]*id="cookie-notice"[^>]*\bhidden\b/);
  });

  it("states honestly that no tracking/advertising cookies are used, and links to the privacy policy", async () => {
    const html = await renderNotice();

    expect(html).toMatch(/no utiliza cookies/i);
    expect(html).toContain('href="/politica-privacidad"');
  });

  it("renders exactly one dismiss button labeled Entendido", async () => {
    const html = await renderNotice();

    const buttonMatches = html.match(/<button[^>]*id="cookie-notice-dismiss"[^>]*>/g) ?? [];
    expect(buttonMatches).toHaveLength(1);
    expect(html).toContain("Entendido");
  });

  it("exposes an accessible region label", async () => {
    const html = await renderNotice();

    expect(html).toMatch(/role="region"/);
    expect(html).toMatch(/aria-label="Aviso de privacidad"/);
  });
});
