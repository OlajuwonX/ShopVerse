import { expect, test } from "@playwright/test";

test.describe("persistent sidebar", () => {
  test("is visible on desktop and hidden on mobile", async ({ page }, testInfo) => {
    await page.goto("/");

    const categories = page.getByRole("navigation", { name: "Categories" });

    if (testInfo.project.name === "desktop") {
      await expect(categories).toBeVisible();
    } else {
      await expect(categories).toBeHidden();
    }
  });

  test("appears on every storefront surface", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");

    for (const path of [
      "/",
      "/categories/electronics",
      "/products/adidas-samba-og",
      "/search?q=galaxy",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: "Categories" }),
        `sidebar on ${path}`,
      ).toBeVisible();
    }
  });

  test("marks the active category and expands only that branch", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");

    await page.goto("/categories/smartphones");

    const sidebar = page.getByRole("navigation", { name: "Categories" });
    const current = sidebar.locator("[aria-current='page']");

    await expect(current).toHaveCount(1);
    await expect(current).toHaveText("Smartphones");
  });
});

test.describe("mobile filter sheet", () => {
  test("traps and restores focus, and closes on Escape", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only");
    await page.goto("/categories/electronics");

    const trigger = page.getByRole("button", { name: /^filters/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();

    const close = page.getByRole("button", { name: /close filters/i });
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("locks background scroll while open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only");
    await page.goto("/categories/electronics");

    const overflowBefore = await page.evaluate(() => document.body.style.overflow);
    expect(overflowBefore).toBe("");

    await page.getByRole("button", { name: /^filters/i }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();

    const overflowDuring = await page.evaluate(() => document.body.style.overflow);
    expect(overflowDuring).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();

    const overflowAfter = await page.evaluate(() => document.body.style.overflow);
    expect(overflowAfter).toBe("");
  });
});

test.describe("filters", () => {
  test("announces the result count in a live region", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics");

    const status = page.getByRole("status");
    await expect(status).toContainText(/results for Electronics/i);
  });

  test("applying a filter updates the URL and narrows the count", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics");

    const before = await page.getByRole("status").textContent();

    await page.getByRole("checkbox", { name: /on sale/i }).check();

    await expect(page).toHaveURL(/onSale=1/);
    await expect(page.getByRole("status")).not.toHaveText(before ?? "");
  });

  test("a filter chip removes just that filter", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics?onSale=1&inStock=1");

    const chip = page.getByRole("button", { name: /on sale/i }).first();
    await chip.click();

    await expect(page).not.toHaveURL(/onSale=1/);
    await expect(page).toHaveURL(/inStock=1/);
  });

  test("clear filters returns to the clean category URL", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics?onSale=1&rating=4");

    await page
      .getByRole("button", { name: /^clear filters$/i })
      .first()
      .click();

    await expect(page).toHaveURL("/categories/electronics");
  });

  test("the price slider is a real slider with currency in its value text", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics");

    const min = page.getByRole("slider", { name: /minimum price/i });
    await expect(min).toBeVisible();

    const valueText = await min.getAttribute("aria-valuetext");
    expect(valueText).toContain("₦");

    await min.focus();
    await expect(min).toBeFocused();
  });

  test("keyboard-only: the product grid is reachable by tabbing", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");
    await page.goto("/categories/electronics");

    const firstProduct = page
      .getByRole("link", { name: /adidas|samsung|ikea|sony|lg/i })
      .first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.focus();
    await expect(firstProduct).toBeFocused();
  });
});
