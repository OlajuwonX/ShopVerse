import { expect, test } from "@playwright/test";

const WIDTHS = [320, 360, 390, 768, 1024, 1440];

test.describe("header layout", () => {
  test("never overflows horizontally at any breakpoint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs its own viewport sweep");

    for (const width of WIDTHS) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("actions sit at the trailing edge of the header", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs its own viewport sweep");

    for (const width of WIDTHS) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/");

      const actions = page.getByRole("button", { name: /account, available soon/i });
      const actionsBox = await actions.boundingBox();
      const rowBox = await page.locator("header > div").first().boundingBox();

      expect(actionsBox, `actions at ${width}px`).not.toBeNull();
      expect(rowBox).not.toBeNull();

      const gapToContentEdge =
        (rowBox?.x ?? 0) +
        (rowBox?.width ?? 0) -
        ((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0));

      expect(gapToContentEdge, `trailing gap at ${width}px`).toBeLessThanOrEqual(40);
    }
  });

  test("action buttons keep a 44px touch target on the smallest screen", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs its own viewport sweep");

    await page.setViewportSize({ height: 900, width: 320 });
    await page.goto("/");

    for (const name of [/wishlist/i, /cart/i, /account/i]) {
      const box = await page.getByRole("button", { name }).boundingBox();

      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("the wordmark is hidden on the narrowest screens but the mark remains", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs its own viewport sweep");

    await page.setViewportSize({ height: 900, width: 320 });
    await page.goto("/");

    const home = page.getByRole("link", { name: /shopverse home/i });
    await expect(home).toBeVisible();

    const box = await home.boundingBox();
    expect(box?.width ?? 0).toBeLessThan(80);
  });

  test("the logo lives in the sidebar on desktop, not the header", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: /shopverse home/i })).toBeHidden();

    const sidebarBrand = page
      .locator("aside")
      .getByRole("link", { name: /shopverse/i })
      .first();

    await expect(sidebarBrand).toBeVisible();
  });

  test("the header no longer carries a discovery nav row", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("navigation", { name: "Product discovery" }),
    ).toHaveCount(0);

    await expect(page.locator("header").getByRole("search")).toBeVisible();
  });

  test("discovery links live in the sidebar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");

    await page.goto("/");

    const discover = page.getByRole("navigation", { name: "Discover" });
    await expect(discover).toBeVisible();
    await expect(discover.getByText("Trending")).toBeVisible();
    await expect(discover.getByText("Offers")).toBeVisible();
  });

  test("the directional header still hides on scroll down and returns on scroll up", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");

    await page.goto("/");

    const header = page.locator("header");
    await expect(header).toHaveAttribute("data-state", "full");

    await page.mouse.wheel(0, 1200);
    await expect(header).toHaveAttribute("data-state", "hidden");

    await page.mouse.wheel(0, -400);
    await expect(header).toHaveAttribute("data-state", "compact");

    await page.mouse.wheel(0, -2000);
    await expect(header).toHaveAttribute("data-state", "full");
  });
});
