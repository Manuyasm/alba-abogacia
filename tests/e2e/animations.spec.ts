import { expect, test } from "@playwright/test";
import { solveCapWidget, waitForHydration } from "./support/cap";

/**
 * E2E for narrow ClientRouter adoption (spec: "Narrow ClientRouter Adoption",
 * "view-transitions" capability; design decision #9, "ClientRouter re-init";
 * animations-v2 PR F). Automates as much of the spec's "Manual Cross-Cutting
 * Verification Checklist" (the orchestrator's 9-item testing checklist) as a
 * real Chromium browser session can exercise. Viewport-specific *visual*
 * review (item 2) and a full desktop/tablet/320px manual pass are reported
 * separately in the PR's own testing-checklist section — not fabricated
 * here as automated assertions where a human eye is what the item actually
 * requires.
 *
 * `[data-header]` scoping is required throughout: `SiteFooter.astro`
 * deliberately duplicates the same nav link labels ("Inicio"/"Servicios"/
 * "El despacho"/"Contacto"), so an unscoped `getByRole("link", { name: ... })`
 * would match two elements and fail Playwright's strict-mode uniqueness
 * check.
 */

test.use({ viewport: { width: 1280, height: 800 } });

function headerLink(page: import("@playwright/test").Page, name: string) {
  return page.locator("[data-header]").getByRole("link", { name, exact: true });
}

test.describe("ClientRouter — header/logo stability across navigation", () => {
  test("the logo link persists as the exact same DOM node across a client-side navigation", async ({ page }) => {
    await page.goto("/");
    // `[data-astro-transition-persist="site-logo"]` uniquely identifies the
    // one persisted element — an unscoped `href="/"` selector also matches
    // both the desktop and mobile "Inicio" nav links, which are NOT persisted.
    const logo = page.locator('[data-astro-transition-persist="site-logo"]');
    await expect(logo).toBeVisible();

    // Mark the live node with a runtime-only property. A `transition:persist`
    // node survives navigation with the same identity, so this marker
    // survives with it; a freshly re-rendered node never carries it.
    await logo.evaluate((el) => {
      (el as unknown as { __e2eMarker?: boolean }).__e2eMarker = true;
    });

    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    const stillMarked = await page
      .locator('[data-astro-transition-persist="site-logo"]')
      .evaluate((el) => Boolean((el as unknown as { __e2eMarker?: boolean }).__e2eMarker));
    expect(stillMarked, "logo link must be the exact same persisted DOM node after navigation").toBe(true);
  });

  test("the logo link remains focusable and keyboard-activatable after a prior client-side navigation", async ({
    page,
  }) => {
    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    const logo = page.locator('[data-astro-transition-persist="site-logo"]');
    await logo.focus();
    await expect(logo).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/^http:\/\/localhost:4321\/$/);
  });

  test("zero console/page errors across a multi-page client-side navigation sequence", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);
    await headerLink(page, "El despacho").click();
    await expect(page).toHaveURL(/\/el-despacho\/?$/);
    await headerLink(page, "Contacto").click();
    await expect(page).toHaveURL(/\/contacto\/?$/);
    await waitForHydration(page);

    expect(errors, `unexpected console/page errors: ${errors.join("\n")}`).toEqual([]);
  });
});

test.describe("ClientRouter — scroll-reveal re-initializes after navigation", () => {
  test("a data-reveal section on a freshly client-side-navigated page still reveals on scroll", async ({ page }) => {
    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    // The LAST `[data-reveal]` element on the page is reliably below the
    // fold at this viewport height (unlike `#area-juridica`, which the
    // desktop 1280x800 viewport can already partially intersect at load).
    const section = page.locator("[data-reveal]").last();
    // Not yet revealed immediately after navigation — its own load doesn't
    // scroll it into view.
    await expect(section).not.toHaveClass(/reveal-visible/);

    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveClass(/reveal-visible/, { timeout: 5000 });
  });

  test("revealing a section, navigating away and back re-observes the fresh page's elements from scratch", async ({
    page,
  }) => {
    await page.goto("/servicios");
    // The LAST `[data-reveal]` element is reliably below the fold at this
    // viewport height (unlike `#area-juridica`, which the desktop 1280x800
    // viewport can already partially intersect at load).
    const firstVisitSection = page.locator("[data-reveal]").last();
    await firstVisitSection.scrollIntoViewIfNeeded();
    await expect(firstVisitSection).toHaveClass(/reveal-visible/);

    await headerLink(page, "Inicio").click();
    await expect(page).toHaveURL(/^http:\/\/localhost:4321\/$/);
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    // Freshly re-rendered server markup for this new page load starts
    // pending again — never carries a stale `reveal-visible` class over
    // from the prior visit to the same route.
    const freshSection = page.locator("[data-reveal]").last();
    await expect(freshSection).not.toHaveClass(/reveal-visible/);
    await freshSection.scrollIntoViewIfNeeded();
    await expect(freshSection).toHaveClass(/reveal-visible/, { timeout: 5000 });
  });
});

test.describe("ClientRouter — Umami click-tracking does not double-fire across navigation", () => {
  test("clicking the persisted header CTA after two client-side navigations fires appointment_click exactly once", async ({
    page,
  }) => {
    // No real Umami script is loaded in this project yet (open item —
    // `trackEvent()` no-ops when `window.umami` is absent); a minimal stub
    // installed before the first navigation is the only way to observe
    // firing counts end-to-end, and — because ClientRouter navigation never
    // replaces `window`/`document` — this stub, unlike a stub installed via
    // `addInitScript` on a real full-page reload, keeps counting correctly
    // across every subsequent client-side navigation in this same test.
    await page.addInitScript(() => {
      (window as unknown as { __umamiCalls: string[] }).__umamiCalls = [];
      (window as unknown as { umami: { track: (name: string) => void } }).umami = {
        track: (name: string) => {
          (window as unknown as { __umamiCalls: string[] }).__umamiCalls.push(name);
        },
      };
    });

    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);
    await headerLink(page, "El despacho").click();
    await expect(page).toHaveURL(/\/el-despacho\/?$/);

    await page.locator('[data-header] a[data-track="appointment_click"]').click();
    await expect(page).toHaveURL(/\/contacto\/?$/);

    const calls = await page.evaluate(() => (window as unknown as { __umamiCalls: string[] }).__umamiCalls);
    expect(calls.filter((name) => name === "appointment_click")).toHaveLength(1);
  });

  test("double-clicking a tracked footer link fires its event exactly twice, never more (no overlapping listeners)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __umamiCalls: string[] }).__umamiCalls = [];
      (window as unknown as { umami: { track: (name: string) => void } }).umami = {
        track: (name: string) => {
          (window as unknown as { __umamiCalls: string[] }).__umamiCalls.push(name);
        },
      };
    });

    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    const phoneLink = page.locator('footer a[data-track="phone_click"]');
    await phoneLink.click({ clickCount: 2 });

    const calls = await page.evaluate(() => (window as unknown as { __umamiCalls: string[] }).__umamiCalls);
    expect(calls.filter((name) => name === "phone_click")).toHaveLength(2);
  });
});

test.describe("ClientRouter — ContactForm/Cap widget remounts cleanly on navigation to /contacto", () => {
  test("navigating from Home to /contacto via a real link click yields a fresh, fully functional Cap widget and form", async ({
    page,
  }) => {
    await page.goto("/");
    await headerLink(page, "Contacto").click();
    await expect(page).toHaveURL(/\/contacto\/?$/);

    // Fresh mount, not a stale/broken carryover from the previous page's
    // island: hydration completes again, and every field starts empty.
    await waitForHydration(page);
    await expect(page.getByLabel("Nombre")).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("");

    await page.getByLabel("Nombre").fill("Ana Pérez");
    await page.getByLabel("Email").fill("ana@example.com");
    await page.getByLabel("Teléfono").fill("600123456");
    await page.getByLabel("Mensaje").fill("Necesito asesoramiento legal sobre un contrato de arrendamiento.");
    await page.getByLabel(/Política de privacidad/).check();
    await solveCapWidget(page);

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/contacto") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    await expect(page.getByRole("status")).toContainText(
      "Su consulta se ha enviado correctamente. Nos pondremos en contacto con usted lo antes posible.",
    );
  });
});

test.describe("prefers-reduced-motion — reveal content stays visible without waiting for scroll behavior to change", () => {
  test.use({ reducedMotion: "reduce" });

  test("data-reveal content is visible on a client-side-navigated page with reduced motion enabled", async ({
    page,
  }) => {
    await page.goto("/");
    await headerLink(page, "Servicios").click();
    await expect(page).toHaveURL(/\/servicios\/?$/);

    // Fail-open contract: content itself is never hidden by this module
    // regardless of the user's motion preference.
    await expect(page.locator("#area-juridica")).toBeVisible();
  });
});

test.describe("No-JS — content remains visible without a client-side router", () => {
  test("Home renders full content with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-header]")).toBeVisible();
    await context.close();
  });

  test("Servicios renders full content, including data-reveal sections, with JavaScript disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/servicios");

    await expect(page.locator("#area-juridica")).toBeVisible();
    await context.close();
  });
});
