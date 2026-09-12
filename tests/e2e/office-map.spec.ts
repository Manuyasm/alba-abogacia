import { expect, test } from "@playwright/test";

/**
 * E2E coverage for the office-map-widget change (PR2, task 5.1): confirms
 * the shared MapLibre GL map — mounted once per page below both
 * `OfficeCard`s (spec: "Map Rendering"; design's page-mounting decision) —
 * actually hydrates and renders a real map canvas plus OpenFreeMap's
 * required attribution once its lazily-loaded (`client:visible`) section
 * scrolls into view, on both pages that render `OfficeCard`. Also confirms
 * the pre-existing "Cómo llegar" link (shipped by the archived `office-map`
 * change) is still present and unregressed by this PR's wiring.
 */

const PAGES = [
  { path: "/", label: "home page" },
  { path: "/el-despacho", label: "el despacho page" },
];

for (const { path, label } of PAGES) {
  test.describe(`OfficeMap on ${label} (${path})`, () => {
    test("renders the map canvas and OpenFreeMap attribution once scrolled into view, with no console errors", async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      await page.goto(path);

      const mapRegion = page.getByRole("region", { name: /Mapa con la ubicación de/ });
      await mapRegion.scrollIntoViewIfNeeded();

      // `client:visible` hydration + MapLibre GL's own `load` event fire
      // asynchronously after the IntersectionObserver trips.
      await expect(mapRegion.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

      const attribution = page.locator(".maplibregl-ctrl-attrib");
      await expect(attribution).toBeVisible();
      await expect(attribution).toContainText("OpenFreeMap");

      expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });

    test('keeps the existing "Cómo llegar" links present and unchanged alongside the map', async ({ page }) => {
      await page.goto(path);

      const langreoLink = page.getByRole("link", { name: "Cómo llegar a Langreo (Asturias)" });
      const madridLink = page.getByRole("link", { name: "Cómo llegar a Madrid" });

      await expect(langreoLink).toBeVisible();
      await expect(madridLink).toBeVisible();
      await expect(langreoLink).toHaveAttribute("target", "_blank");
      await expect(madridLink).toHaveAttribute("target", "_blank");
    });
  });
}
