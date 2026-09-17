import { expect, test } from "@playwright/test";

test("publishes the approved crawl discovery and page metadata policy", async ({ page, request }) => {
  await page.goto("/contacto");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Información de contacto de ALBA Abogacía & Consulting en Langreo (Asturias).",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://alba-abogacia.es/contacto",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

  await page.goto("/politica-privacidad");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");

  await page.goto("/aviso-legal");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
  await expect(robotsResponse.text()).resolves.toBe(
    "User-agent: *\nAllow: /\n\nSitemap: https://alba-abogacia.es/sitemap-index.xml\n",
  );

  const sitemapIndexResponse = await request.get("/sitemap-index.xml");
  expect(sitemapIndexResponse.status()).toBe(200);
  const sitemapIndex = await sitemapIndexResponse.text();
  const sitemapUrl = sitemapIndex.match(/<loc>(https:\/\/alba-abogacia\.es\/sitemap-\d+\.xml)<\/loc>/)?.[1];
  expect(sitemapUrl).toBeDefined();

  const sitemapResponse = await request.get(new URL(sitemapUrl ?? "", "https://alba-abogacia.es").pathname);
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("https://alba-abogacia.es/contacto");
  expect(sitemap).not.toContain("https://alba-abogacia.es/politica-privacidad");
  expect(sitemap).not.toContain("https://alba-abogacia.es/aviso-legal");
});
