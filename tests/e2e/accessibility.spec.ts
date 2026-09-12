import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./support/cap";

/**
 * Automated accessibility scan (spec: "Accessibility"; AGENTS.md WCAG 2.2 AA
 * target) via axe-core on every page this change ships or touches. Zero
 * critical/serious violations required; moderate/minor findings are
 * documented in the PR5 apply-progress report rather than silently ignored.
 *
 * office-map-widget PR2 (task 5.2): extended with `/el-despacho` (the other
 * page rendering `OfficeCard`) and, on both office-map pages, an explicit
 * scroll-into-view + hydration wait for the map region before scanning, so
 * the scan covers the offices section with the real hydrated map present —
 * not just its server-rendered shell.
 */

const PAGES = [
  { path: "/contacto", label: "standalone contact page", hasContactForm: true, hasOfficeMap: false },
  { path: "/", label: "home page (includes #contacto)", hasContactForm: true, hasOfficeMap: true },
  { path: "/el-despacho", label: "el despacho page (offices + map)", hasContactForm: false, hasOfficeMap: true },
  { path: "/politica-privacidad", label: "privacy policy page", hasContactForm: false, hasOfficeMap: false },
];

for (const { path, label, hasContactForm, hasOfficeMap } of PAGES) {
  test(`axe scan: ${label} (${path}) has no critical or serious violations`, async ({ page }) => {
    await page.goto(path);
    // Let the client:idle island hydrate and the real Cap widget mount
    // before scanning, so the scan reflects real post-hydration DOM, not
    // just the server-rendered shell. `networkidle` alone is unreliable
    // here (the widget's own WASM/worker traffic can keep the network
    // "busy" well past when the DOM is actually settled).
    if (hasContactForm) {
      await waitForHydration(page);
    } else {
      await page.waitForLoadState("load");
    }

    if (hasOfficeMap) {
      // `OfficeMap` is `client:visible` — scroll it into view and wait for
      // the real MapLibre GL canvas so the scan reflects the hydrated map,
      // not just its reserved-size, unhydrated container.
      const mapRegion = page.getByRole("region", { name: /Mapa con la ubicación de/ });
      await mapRegion.scrollIntoViewIfNeeded();
      await expect(mapRegion.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    const other = results.violations.filter((v) => v.impact !== "critical" && v.impact !== "serious");

    if (other.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[axe] ${label}: ${other.length} moderate/minor finding(s):`,
        other.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("; "),
      );
    }

    expect(
      [...critical, ...serious],
      `${label} must have zero critical/serious axe violations, found: ${[...critical, ...serious]
        .map((v) => `${v.id} (${v.impact}): ${v.help}`)
        .join("; ")}`,
    ).toHaveLength(0);
  });
}
