import { expect, test, type Locator, type Page } from "@playwright/test";

const HOME_GRID = "More for you";
const CATEGORY_GRID = "Electronics products";

function grid(page: Page, name: string): Locator {
  return page.getByRole("list", { name });
}

function cards(gridLocator: Locator) {
  return gridLocator.locator("a[href^='/products/']");
}

function hrefsIn(gridLocator: Locator) {
  return gridLocator
    .locator("a[href^='/products/']")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
}

async function scrollToEnd(page: Page, maxPages: number) {
  const done = page.getByText(/All \d+ products shown/);

  for (let attempt = 0; attempt < maxPages; attempt += 1) {
    if (await done.isVisible().catch(() => false)) {
      return;
    }

    const response = page
      .waitForResponse(
        (candidate) => candidate.url().includes("/api/products") && candidate.ok(),
        { timeout: 10_000 },
      )
      .catch(() => null);

    await page.mouse.move(900, 500);
    await page.mouse.wheel(0, 8000);

    await response;
    await page.waitForTimeout(500);
  }
}

test.describe("infinite discovery", () => {
  test("server-renders the first page without a client fetch", async ({ page }) => {
    const requests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/products")) {
        requests.push(request.url());
      }
    });

    await page.goto("/categories/electronics");
    await expect(cards(grid(page, CATEGORY_GRID)).first()).toBeVisible();
    await page.waitForTimeout(800);

    expect(requests, "initial data must hydrate, not refetch").toEqual([]);
  });

  test("loads the next page when the sentinel approaches the viewport", async ({
    page,
  }) => {
    await page.goto("/");

    const homeGrid = grid(page, HOME_GRID);
    await expect(cards(homeGrid).first()).toBeVisible();

    const before = await cards(homeGrid).count();
    expect(before).toBeGreaterThan(0);

    const response = page.waitForResponse(
      (candidate) => candidate.url().includes("/api/products") && candidate.ok(),
    );

    await homeGrid.scrollIntoViewIfNeeded();
    await page.mouse.move(900, 500);
    await page.mouse.wheel(0, 6000);

    await response;

    await expect
      .poll(() => cards(homeGrid).count(), { timeout: 15_000 })
      .toBeGreaterThan(before);
  });

  test("exposes a keyboard-reachable load-more control", async ({ page }) => {
    await page.goto("/");

    const homeGrid = grid(page, HOME_GRID);
    await expect(cards(homeGrid).first()).toBeVisible();

    const loadMore = page.getByRole("button", { name: /load more products/i });

    await expect(loadMore).toBeVisible();
    await expect(loadMore).toBeEnabled();

    await loadMore.focus();
    await expect(loadMore).toBeFocused();
  });

  test("announces progress in a polite live region", async ({ page }) => {
    await page.goto("/categories/electronics");

    const status = page.getByText(/Showing \d+ of \d+ products/);

    await expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("never renders a duplicate product across pages", async ({ page }) => {
    await page.goto("/");

    const homeGrid = grid(page, HOME_GRID);
    await expect(cards(homeGrid).first()).toBeVisible();

    await scrollToEnd(page, 4);

    const hrefs = await hrefsIn(homeGrid);

    expect(hrefs.length).toBeGreaterThan(24);
    expect(new Set(hrefs).size, "cursor pagination must not repeat rows").toBe(
      hrefs.length,
    );
  });

  test("stops at the end and reports the full count (PERF-07)", async ({ page }) => {
    await page.goto("/");

    const homeGrid = grid(page, HOME_GRID);
    await expect(cards(homeGrid).first()).toBeVisible();

    await scrollToEnd(page, 8);

    await expect(
      page.getByRole("button", { name: /load more products/i }),
    ).toBeHidden();
    await expect(page.getByText(/All \d+ products shown/)).toBeVisible();

    const metrics = await page.evaluate(() => ({
      cards: document.querySelectorAll("a[href^='/products/']").length,
      nodes: document.getElementsByTagName("*").length,
    }));

    expect(metrics.nodes, `DOM nodes with ${metrics.cards} cards`).toBeLessThan(8_000);
  });

  test("a filter change resets the list rather than appending", async ({ page }) => {
    await page.goto("/categories/electronics");

    const before = await cards(grid(page, CATEGORY_GRID)).count();

    await page.goto("/categories/electronics?onSale=1");

    await expect
      .poll(() => cards(grid(page, CATEGORY_GRID)).count(), { timeout: 10_000 })
      .toBeLessThan(before);
  });

  test("search results render through the same machinery", async ({ page }) => {
    await page.goto("/search?q=galaxy");

    const searchGrid = grid(page, "Search results for galaxy");
    await expect(cards(searchGrid).first()).toBeVisible();

    const hrefs = await hrefsIn(searchGrid);

    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
