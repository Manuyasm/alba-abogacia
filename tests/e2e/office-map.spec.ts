import { expect, test } from "@playwright/test";

/**
 * E2E coverage for the office-map-per-office redesign: confirms each
 * `OfficeCard` now mounts its OWN small MapLibre GL map (spec: "Map
 * Rendering"), instead of one shared map for every office. Each map
 * hydrates and renders a real canvas plus OpenFreeMap's required
 * attribution once its own lazily-loaded (`client:visible`) card scrolls
 * into view, on both pages that render `OfficeCard`. Also confirms the
 * pre-existing "Cómo llegar" link (shipped by the archived `office-map`
 * change) is still present and unregressed by this redesign.
 */

const PAGES = [
  { path: "/", label: "home page" },
  { path: "/el-despacho", label: "el despacho page" },
];

const OFFICE_NAMES = ["Langreo (Asturias)", "Madrid"];

for (const { path, label } of PAGES) {
  test.describe(`Per-office OfficeMap on ${label} (${path})`, () => {
    test("renders one map canvas per office, each with OpenFreeMap attribution, with no console errors", async ({
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

      for (const officeName of OFFICE_NAMES) {
        const mapRegion = page.getByRole("region", { name: `Mapa de ubicación de ${officeName}` });
        await mapRegion.scrollIntoViewIfNeeded();

        // `client:visible` hydration + MapLibre GL's own `load` event fire
        // asynchronously after the IntersectionObserver trips.
        await expect(mapRegion.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
      }

      const attributions = page.locator(".maplibregl-ctrl-attrib");
      await expect(attributions).toHaveCount(OFFICE_NAMES.length);
      for (const attribution of await attributions.all()) {
        await expect(attribution).toBeVisible();
        await expect(attribution).toContainText("OpenFreeMap");
      }

      expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });

    test("each office's map is independent, with no cross-office marker leakage", async ({ page }) => {
      await page.goto(path);

      const langreoRegion = page.getByRole("region", { name: "Mapa de ubicación de Langreo (Asturias)" });
      const madridRegion = page.getByRole("region", { name: "Mapa de ubicación de Madrid" });

      await langreoRegion.scrollIntoViewIfNeeded();
      await expect(langreoRegion.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
      await madridRegion.scrollIntoViewIfNeeded();
      await expect(madridRegion.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });

      // Exactly one marker per map region.
      await expect(langreoRegion.locator(".maplibregl-marker")).toHaveCount(1);
      await expect(madridRegion.locator(".maplibregl-marker")).toHaveCount(1);
    });

    test('keeps the existing "Cómo llegar" links present and unchanged alongside each map', async ({ page }) => {
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
