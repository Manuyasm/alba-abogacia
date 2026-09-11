import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Solves the real, live `<cap-widget>` mounted by `ContactForm.tsx` (see
 * `docs`/apply-progress: this E2E run targets a genuine self-hosted Cap
 * Standalone + Valkey instance brought up via `docker-compose.yml`, not a
 * mock — see `tests/e2e/README.md` for why and how).
 *
 * `@cap.js/widget` renders its interactive trigger inside an open shadow
 * root as `role="button"` (`tabindex="0"`), matching a checkbox-style
 * "verify you are human" control (confirmed by reading the package's own
 * source, `src/cap.js`). Playwright's CSS-based locators pierce open shadow
 * roots, so `page.locator("cap-widget").getByRole("button")` finds it
 * without any custom shadow-DOM plumbing.
 */
export function capWidgetTrigger(page: Page): Locator {
  return page.locator("cap-widget").getByRole("button");
}

/**
 * The widget also renders its own "Secured by Cap" credits link
 * (`aria-label="Secured by Cap"`, visible text "Cap", linking to
 * `https://trycap.dev`) inside the same shadow root, immediately after the
 * trigger in DOM/tab order (confirmed by reading `src/cap.js`). It is a
 * genuine extra keyboard-reachable stop the real widget provides — the
 * keyboard-operability suite accounts for it rather than assuming the
 * widget is a single Tab-stop.
 */
export function capWidgetCreditsLink(page: Page): Locator {
  return page.locator("cap-widget").getByRole("link", { name: "Secured by Cap" });
}

/**
 * `ContactForm.tsx` is a `client:idle` island: the browser first paints the
 * server-rendered markup, then React hydrates asynchronously. The real
 * `<cap-widget>` element is created imperatively inside a `useEffect` (see
 * that file's doc comment — this is also the fix for a hydration-mismatch
 * bug this E2E suite caught), so it only exists in the DOM once hydration
 * has actually completed. Filling form fields before that point writes
 * directly to the un-hydrated DOM node; React's controlled `<input>` then
 * overwrites that value with its own (still-initial, empty) state on the
 * next render, silently discarding whatever was typed. Every test that
 * interacts with the form must wait for this signal first.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator("cap-widget")).toBeAttached({ timeout: 10_000 });
}

/** Clicks the widget and waits for it to report a solved token. */
export async function solveCapWidget(page: Page): Promise<void> {
  await waitForHydration(page);
  await capWidgetTrigger(page).click();
  await page.waitForFunction(
    () => {
      const widget = document.querySelector("cap-widget") as { token?: string | null } | null;
      return Boolean(widget?.token);
    },
    { timeout: 20_000 },
  );
}
