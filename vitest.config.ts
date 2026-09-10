import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Standalone Vitest config (not `getViteConfig` from astro/config) so unit/component
// tests run fast without booting the Astro dev pipeline. React islands are tested via
// @testing-library/react in a jsdom environment; server-side lib code (validation,
// captcha, email, analytics) runs in the same environment since it has no DOM needs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
