import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static-first site: `output: "server"` with per-route `prerender` is used so that
// every page is prerendered to static HTML by default, and only routes that opt out
// (e.g. `src/pages/api/contacto.ts`, which sets `export const prerender = false`)
// are rendered on demand by the Node adapter. See DESIGN.md §1 and AGENTS.md §3/§8.
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
