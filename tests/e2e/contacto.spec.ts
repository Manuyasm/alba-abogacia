import { expect, test } from "@playwright/test";
import { solveCapWidget, waitForHydration } from "./support/cap";

/**
 * E2E for `/contacto` (spec: "contact-form-submission", "captcha-verification",
 * "Accessibility"). See `tests/e2e/README.md` for how the live Cap Standalone
 * instance and the `CONTACT_EMAIL_TEST_MODE` test email transport are wired
 * for this run.
 */

const VALID = {
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "600123456",
  mensaje: "Necesito asesoramiento legal sobre un contrato de arrendamiento.",
};

async function fillValidFields(page: import("@playwright/test").Page) {
  // Wait for the client:idle island to hydrate before filling — see
  // `support/cap.ts`'s `waitForHydration` doc comment for why this matters.
  await waitForHydration(page);
  await page.getByLabel("Nombre").fill(VALID.nombre);
  await page.getByLabel("Email").fill(VALID.email);
  await page.getByLabel("Teléfono").fill(VALID.telefono);
  await page.getByLabel("Mensaje").fill(VALID.mensaje);
  await page.getByLabel(/Política de privacidad/).check();
}

test.describe("Contact form — /contacto", () => {
  test("full success flow: fill all fields, solve Cap, submit, reach client-side success", async ({
    page,
  }) => {
    await page.goto("/contacto");
    await fillValidFields(page);
    await solveCapWidget(page);

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/contacto") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    await expect(page.getByRole("status")).toContainText(
      "Gracias por su mensaje. Nos pondremos en contacto con usted lo antes posible.",
    );
    // Form resets on success — no leftover values, no stale error alerts.
    await expect(page.getByLabel("Nombre")).toHaveValue("");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("honeypot-filled submission is silently rejected client-side with zero visible feedback", async ({
    page,
  }) => {
    await page.goto("/contacto");
    await fillValidFields(page);
    await solveCapWidget(page);

    // A real bot fills every field it can find in the DOM, including the
    // hidden honeypot (`name="empresa"`) that real users never see
    // (off-screen, `aria-hidden`, `tabIndex={-1}`). `force: true` bypasses
    // Playwright's visibility actionability check for this deliberately
    // off-screen field while still dispatching a real, React-observable
    // input event.
    await page.locator('input[name="empresa"]').fill("Empresa Bot S.L.", { force: true });

    // Discovery (documented in apply-progress): `ContactSchema` itself
    // requires `honeypot: z.string().max(0)`, so a honeypot-filled payload
    // already fails *client-side* validation before ever reaching `fetch`.
    // Since `honeypot` has no entry in `FIELD_ERROR_MESSAGES` or
    // `FOCUS_ORDER` (deliberately — the spec says never reveal its
    // existence), the block is completely silent: no error text, no ARIA
    // alert, no focus change, no network request. This is a stricter form
    // of "silently rejected without revealing the honeypot's existence"
    // than a bot ever reaches — the server-level pipeline-order proof above
    // covers the case of a bot that bypasses the client entirely.
    let requestMade = false;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/contacto")) requestMade = true;
    });

    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await page.waitForTimeout(300);

    expect(requestMade, "no request should be sent for a honeypot-filled submission").toBe(false);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("honeypot short-circuits before Cap verification (server-level proof)", async ({ request }) => {
    // Direct API-level proof, independent of the UI: a payload with the
    // honeypot filled AND a deliberately empty/unsolved Cap token still
    // returns a generic success — proving the pipeline order documented in
    // `src/pages/api/contacto.ts` (honeypot check runs before Cap
    // verification), not just a UI-level coincidence.
    const response = await request.post("/api/contacto", {
      data: {
        ...VALID,
        aceptaPrivacidad: true,
        honeypot: "soy-un-bot",
        capToken: "",
      },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  test("validation errors block submission and focus the first invalid field", async ({ page }) => {
    await page.goto("/contacto");
    await waitForHydration(page);

    // No request should ever be attempted — client-side validation blocks it.
    // Registered before the click so no early request can be missed.
    let requestMade = false;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/contacto")) requestMade = true;
    });

    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    const alerts = page.getByRole("alert");
    await expect(alerts).not.toHaveCount(0);
    await expect(page.getByLabel("Nombre")).toBeFocused();

    const nombreError = page.getByText("Introduzca su nombre.");
    await expect(nombreError).toBeVisible();
    const describedBy = await page.getByLabel("Nombre").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText("Introduzca su nombre.");

    await page.waitForTimeout(200);
    expect(requestMade).toBe(false);
  });

  test("unchecked consent blocks submission with a visible, announced error", async ({ page }) => {
    await page.goto("/contacto");
    await waitForHydration(page);
    await page.getByLabel("Nombre").fill(VALID.nombre);
    await page.getByLabel("Email").fill(VALID.email);
    await page.getByLabel("Teléfono").fill(VALID.telefono);
    await page.getByLabel("Mensaje").fill(VALID.mensaje);

    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await expect(page.getByText("Debe aceptar la Política de privacidad para continuar.")).toBeVisible();
    await expect(page.getByLabel(/Política de privacidad/)).toBeFocused();
  });
});

test.describe("Contact form — embedded on / (#contacto)", () => {
  test("embedded section on index.astro works identically to the standalone page", async ({ page }) => {
    await page.goto("/#contacto");
    await waitForHydration(page);
    const section = page.locator("#contacto");
    await expect(section.getByRole("heading", { name: /Póngase en contacto/ })).toBeVisible();

    await section.getByLabel("Nombre").fill(VALID.nombre);
    await section.getByLabel("Email").fill(VALID.email);
    await section.getByLabel("Teléfono").fill(VALID.telefono);
    await section.getByLabel("Mensaje").fill(VALID.mensaje);
    await section.getByLabel(/Política de privacidad/).check();
    await solveCapWidget(page);

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/contacto") && response.request().method() === "POST",
    );
    await section.getByRole("button", { name: "Enviar mensaje" }).click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    await expect(section.getByRole("status")).toContainText("Gracias por su mensaje");
  });
});
