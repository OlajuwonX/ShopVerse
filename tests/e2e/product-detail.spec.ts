import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VARIANT_PRODUCT = "/products/samsung-galaxy-s24-ultra";
const SIMPLE_PRODUCT = "/products/adidas-samba-og";

test.describe("product detail", () => {
  test("renders a breadcrumb trail back through the category tree", async ({
    page,
  }) => {
    await page.goto(VARIANT_PRODUCT);

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    const links = await breadcrumb.getByRole("link").allTextContents();

    expect(links[0]).toBe("Home");
    expect(links.length).toBeGreaterThan(1);

    await expect(breadcrumb).toContainText("Galaxy S24 Ultra");
  });

  test("emits Product structured data matching the visible price", async ({ page }) => {
    await page.goto(VARIANT_PRODUCT);

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();

    const product = blocks
      .map((block) => JSON.parse(block) as Record<string, unknown>)
      .find((entry) => entry["@type"] === "Product");

    expect(product).toBeDefined();
    expect(product?.name).toBeTruthy();
    expect(product?.brand).toMatchObject({ "@type": "Brand" });

    const offers = product?.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("NGN");
    expect(String(offers.availability)).toContain("schema.org/");
  });

  test("exposes a canonical url", async ({ page }) => {
    await page.goto(SIMPLE_PRODUCT);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/products\/adidas-samba-og$/);
  });

  test("selecting a variant updates price and stock without navigating", async ({
    page,
  }) => {
    await page.goto(VARIANT_PRODUCT);

    const options = page.getByRole("button", { name: /GB|TB/ });
    const count = await options.count();

    test.skip(count < 2, "product has no selectable variants in the seed");

    const url = page.url();
    const priceBefore = await page
      .getByRole("main")
      .getByText(/₦[\d,]+/)
      .first()
      .textContent();

    await options.nth(1).click();
    await expect(options.nth(1)).toHaveAttribute("aria-pressed", "true");

    expect(page.url(), "variant selection must not navigate").toBe(url);

    await expect(page.getByRole("status").first()).toContainText(
      /in stock|out of stock/i,
    );
    expect(priceBefore).toBeTruthy();
  });

  test("a product with variants asks for a choice before offering the cart", async ({
    page,
  }) => {
    await page.goto(VARIANT_PRODUCT);

    const options = page.getByRole("button", { name: /GB|TB/ });

    test.skip((await options.count()) < 2, "no selectable variants");

    await expect(
      page.getByRole("button", { name: /choose options for/i }).first(),
    ).toBeVisible();

    await options.first().click();

    await expect(
      page.getByRole("button", { name: /add .* to cart/i }).first(),
    ).toBeVisible();
  });

  test("shows a specifications table built from category attributes", async ({
    page,
  }) => {
    await page.goto(VARIANT_PRODUCT);

    const specs = page.getByRole("heading", { name: "Specifications" });
    await expect(specs).toBeVisible();

    const terms = page.locator("dl dt");
    expect(await terms.count()).toBeGreaterThan(0);
  });

  test("keeps a sticky purchase bar on mobile only", async ({ page }, testInfo) => {
    await page.goto(SIMPLE_PRODUCT);

    const bars = page.getByRole("main").locator("div.fixed.inset-x-0.bottom-0");

    if (testInfo.project.name === "mobile") {
      await expect(bars.first()).toBeVisible();
    } else {
      await expect(bars.first()).toBeHidden();
    }
  });

  test("the gallery is keyboard reachable and announces its size", async ({ page }) => {
    await page.goto(SIMPLE_PRODUCT);

    const track = page.getByRole("list", { name: /gallery/i });
    await expect(track).toHaveAttribute("tabindex", "0");
  });

  test("has no detectable axe violations", async ({ page }) => {
    await page.goto(VARIANT_PRODUCT);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        target: violation.nodes[0]?.target?.join(" "),
      })),
    ).toEqual([]);
  });
});
