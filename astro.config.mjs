import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// office-map-widget (PR2): MapLibre GL resolves its Web Worker's script and
// that worker's own sibling "shared" chunk (`maplibre-gl-worker.mjs` +
// `maplibre-gl-shared.mjs`) via plain runtime string URLs computed relative
// to its own bundled module — never the literal `new Worker(new URL(...))`
// syntax Vite's worker plugin statically detects. Neither file is ever
// discovered or emitted by a normal Vite/Astro build, so the map's Web
// Worker silently 404s in production, `map.fitBounds` (which fires only
// after the worker-backed style/tile pipeline reaches `load`) never runs,
// and markers render at their raw unfitted projected position. This plugin
// copies both files, unmodified, into `public/vendor/maplibre-gl/` before
// dev/build so Astro serves them at a stable, predictable path (mirroring
// their real sibling relationship, so the worker's own internal relative
// import resolves correctly); `OfficeMap.tsx` then points MapLibre at that
// path via `setWorkerUrl`. `public/vendor/` is gitignored — it is
// regenerated from `node_modules/maplibre-gl` on every dev/build start, not
// committed. See `sdd/office-map-widget/apply-progress` (PR2) for the full
// diagnosis.
function copyMapLibreWorkerAssets() {
  return {
    name: "copy-maplibre-gl-worker-assets",
    buildStart() {
      const outDir = fileURLToPath(new URL("./public/vendor/maplibre-gl/", import.meta.url));
      const pkgRoot = dirname(fileURLToPath(import.meta.resolve("maplibre-gl/package.json")));
      mkdirSync(outDir, { recursive: true });
      for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
        const source = join(pkgRoot, "dist", file);
        if (existsSync(source)) {
          copyFileSync(source, join(outDir, file));
        }
      }
    },
  };
}

// Static-first site: `output: "static"` with the Node adapter prerenders every page
// to static HTML by default, and only routes that opt out
// (e.g. `src/pages/api/contacto.ts`, which sets `export const prerender = false`)
// are rendered on demand by the Node adapter. See DESIGN.md §1 and AGENTS.md §3/§8.
export default defineConfig({
  output: "static",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), copyMapLibreWorkerAssets()],
  },
});
