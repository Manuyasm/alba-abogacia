import { expect, test } from "@playwright/test";

const legalServices = [
  "Litigios y Disputas",
  "Derecho Corporativo",
  "Derecho de familia y menores",
  "Derecho Laboral",
  "Derecho hereditario",
];

const financialServices = [
  "Planificación financiera",
  "Gestión de Riesgos",
  "Asesoría en Inversiones",
  "Reestructuración Financiera",
  "Análisis de Viabilidad de Proyectos",
];

test("renders the confirmed semantic services content", async ({ page }) => {
  await page.goto("/servicios");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Asesoría legal" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Consultoría financiera" })).toBeVisible();

  const legalSection = page.locator("#area-juridica");
  const financialSection = page.locator("#area-financiera");
  await expect(legalSection.getByRole("heading", { level: 3 })).toHaveText(legalServices);
  await expect(financialSection.getByRole("heading", { level: 3 })).toHaveText(financialServices);
  await expect(legalSection.locator('a[href="/contacto"]')).toHaveCount(5);
  await expect(financialSection.locator('a[href="/contacto"]')).toHaveCount(5);
  await expect(legalSection).toContainText("Nuestro equipo de abogados expertos está dedicado a proporcionar soluciones legales efectivas y personalizadas para una variedad de necesidades.");
  await expect(financialSection).toContainText("Ofrecemos servicios de consultoría financiera para ayudarle a gestionar sus recursos de manera eficiente y alcanzar sus objetivos financieros.");
});

test("keeps the mobile page within the viewport and exposes a visible contact CTA focus state", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/servicios");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const firstContactCta = page.locator('#area-juridica a[href="/contacto"]').first();
  await firstContactCta.focus();
  await expect(firstContactCta).toBeFocused();
  await expect(firstContactCta).toHaveClass(/focus-visible:ring-2/);
});
