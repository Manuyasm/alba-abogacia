import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./support/cap";

/**
 * Automated accessibility scan (spec: "Accessibility"; AGENTS.md WCAG 2.2 AA
 * target) via axe-core on every page this change ships or touches. Zero
 * critical/serious violations required; moderate/minor findings are
 * documented in the PR5 apply-progress report rather than silently ignored.
 */

const PAGES = [
  { path: "/contacto", label: "standalone contact page", hasContactForm: true },
  { path: "/", label: "home page (includes #contacto)", hasContactForm: true },
  { path: "/politica-privacidad", label: "privacy policy page", hasContactForm: false },
];

for (const { path, label, hasContactForm } of PAGES) {
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
