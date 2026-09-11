import { expect, test, type Locator } from "@playwright/test";
import { capWidgetCreditsLink, capWidgetTrigger, solveCapWidget, waitForHydration } from "./support/cap";

/**
 * E2E for spec scenario "Full keyboard operability" (capability
 * `contact-form-submission`, requirement "Accessibility") — the scenario
 * PR1-4's verify report explicitly left PARTIAL/deferred to this PR. Proves,
 * against the real built `/contacto` page in a real Chromium browser:
 * every field, the consent checkbox + its Política de privacidad link, the
 * real Cap widget, and the submit button are reachable by Tab in logical
 * order, each with a visible focus indicator, and there is no keyboard trap.
 */

/** A visible focus indicator is either a non-`none` outline or box-shadow. */
async function hasVisibleFocusIndicator(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const hasOutline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
    const hasShadow = style.boxShadow !== "none" && style.boxShadow !== "";
    return hasOutline || hasShadow;
  });
}

async function expectFocusedWithIndicator(locator: Locator, label: string) {
  await expect(locator, `expected ${label} to be focused`).toBeFocused();
  expect(await hasVisibleFocusIndicator(locator), `expected ${label} to show a visible focus indicator`).toBe(
    true,
  );
}

test.describe("Contact form — keyboard operability (/contacto)", () => {
  test("Tab reaches every field, the consent link, the Cap widget, and submit, in order, with visible focus", async ({
    page,
  }) => {
    await page.goto("/contacto");
    await waitForHydration(page);

    // Start from a known point: focus the document body, then Tab forward.
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Tab");

    const nombre = page.getByLabel("Nombre");
    const email = page.getByLabel("Email");
    const telefono = page.getByLabel("Teléfono");
    const mensaje = page.getByLabel("Mensaje");
    const consentCheckbox = page.getByRole("checkbox", { name: /Política de privacidad/ });
    const consentLink = page.getByRole("link", { name: "Política de privacidad" });
    const submit = page.getByRole("button", { name: "Enviar mensaje" });

    // Tab order must land on nombre first (whatever received initial focus
    // from the body click is not asserted — only the meaningful sequence
    // from there on is).
    await nombre.focus();
    await expectFocusedWithIndicator(nombre, "nombre");

    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(email, "email");

    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(telefono, "teléfono");

    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(mensaje, "mensaje");

    // The honeypot field (tabIndex={-1}) must be skipped entirely.
    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(consentCheckbox, "consent checkbox");

    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(consentLink, "Política de privacidad link");

    await page.keyboard.press("Tab");
    const trigger = capWidgetTrigger(page);
    await expectFocusedWithIndicator(trigger, "Cap widget trigger");

    // The widget's own "Secured by Cap" credits link is a second, genuine
    // Tab-stop inside its shadow root (see `support/cap.ts`).
    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(capWidgetCreditsLink(page), "Cap widget credits link");

    await page.keyboard.press("Tab");
    await expectFocusedWithIndicator(submit, "submit button");

    // No keyboard trap: one more Tab moves focus away from the submit
    // button (to whatever comes next in the document, even if that's back
    // to the browser chrome / end of document) rather than freezing on it.
    const submitHandle = await submit.elementHandle();
    await page.keyboard.press("Tab");
    const stillOnSubmit = await page.evaluate((el) => document.activeElement === el, submitHandle);
    expect(stillOnSubmit, "focus must not be trapped on the submit button").toBe(false);
  });

  test("the Cap widget is solvable via keyboard alone (Enter activates it)", async ({ page }) => {
    await page.goto("/contacto");
    await waitForHydration(page);

    await capWidgetTrigger(page).focus();
    await page.keyboard.press("Enter");

    await page.waitForFunction(
      () => {
        const widget = document.querySelector("cap-widget") as { token?: string | null } | null;
        return Boolean(widget?.token);
      },
      { timeout: 20_000 },
    );
  });

  test("shift+Tab reverses through the same sequence without getting stuck", async ({ page }) => {
    await page.goto("/contacto");
    await solveCapWidget(page); // ensures the widget's post-solve state is also keyboard-reachable

    const submit = page.getByRole("button", { name: "Enviar mensaje" });
    await submit.focus();
    await expect(submit).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    // Immediately preceding the submit button is the widget's own credits link.
    await expect(capWidgetCreditsLink(page)).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    // Then the solved Cap widget's trigger (still focusable after solving).
    await expect(capWidgetTrigger(page)).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Política de privacidad" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("checkbox", { name: /Política de privacidad/ })).toBeFocused();
  });
});
