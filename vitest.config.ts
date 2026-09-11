import { defineConfig, defineProject } from "vitest/config";
import { getViteConfig } from "astro/config";
import react from "@vitejs/plugin-react";

// Vitest 5 "projects" API (root config becomes a container that only lists
// projects; it never runs tests itself — see Vitest's `test.projects` docs).
// Two projects share a single `pnpm test` invocation:
//
// - "unit": the original standalone Vite config (react plugin + jsdom),
//   UNCHANGED in behavior, for every pre-existing `.test.ts`/`.test.tsx` file
//   (React islands via @testing-library/react, plain server-side lib code).
// - "astro": Astro's own Vite config (via `getViteConfig`, which loads
//   `astro.config.ts` — Astro compiler, `@astrojs/react`, Tailwind vite
//   plugin) so `.astro` files can be imported directly and exercised with
//   Astro's experimental Container API (`astro/container`). This is the
//   first `.astro` component test in the repo (see `BaseLayout.test.ts`);
//   scoped to its own project so the Astro compiler plugin never touches the
//   "unit" project's transform pipeline. PR2 extends its `include` glob to
//   `src/components/common/**/*.test.ts` for `SiteHeader`/`SiteFooter`, per
//   the plan documented in PR1's apply-progress. PR3 extends it again with
//   `src/pages/*.test.ts` (single-level only — deliberately does NOT match
//   `src/pages/api/**`, which stays on the "unit" project unaffected) for
//   `contacto.astro`'s page-level regression test.
export default defineConfig({
  test: {
    projects: [
      defineProject({
        plugins: [react()],
        resolve: {
          alias: {
            "@": new URL("./src", import.meta.url).pathname,
          },
        },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [
            "tests/e2e/**",
            "src/layouts/**/*.test.ts",
            "src/components/common/**/*.test.ts",
            "src/pages/*.test.ts",
          ],
        },
      }),
      getViteConfig({
        test: {
          name: "astro",
          environment: "node",
          globals: true,
          include: ["src/layouts/**/*.test.ts", "src/components/common/**/*.test.ts", "src/pages/*.test.ts"],
        },
      }),
    ],
  },
});
