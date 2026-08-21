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
      const rowBox = await page
        .getByRole("banner")
        .locator("> div")
        .first()
        .boundingBox();

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

    await expect(page.getByRole("banner").getByRole("search")).toBeVisible();
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

    const header = page.getByRole("banner");
    await expect(header).toHaveAttribute("data-state", "full");

    const viewport = page.viewportSize();
    await page.mouse.move(
      (viewport?.width ?? 1440) - 200,
      (viewport?.height ?? 900) / 2,
    );

    await page.mouse.wheel(0, 1200);
    await expect(header).toHaveAttribute("data-state", "hidden");

    await page.mouse.wheel(0, -400);
    await expect(header).toHaveAttribute("data-state", "compact");

    await page.mouse.wheel(0, -2000);
    await expect(header).toHaveAttribute("data-state", "full");
  });
});

test.describe("independent scroll regions", () => {
  test("the content pane and sidebar scroll separately", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only shell");

    await page.setViewportSize({ height: 700, width: 1440 });
    await page.goto("/categories/electronics");

    const offsets = () =>
      page.evaluate(() => ({
        aside: document.querySelector("aside")?.scrollTop ?? -1,
        content: document.getElementById("app-scroll")?.scrollTop ?? -1,
        window: window.scrollY,
      }));

    expect(await offsets()).toEqual({ aside: 0, content: 0, window: 0 });

    await page.locator("#app-scroll").evaluate((node) => {
      node.scrollTop = 600;
    });

    const afterContent = await offsets();
    expect(afterContent.content).toBeGreaterThan(0);
    expect(afterContent.aside, "sidebar must not move").toBe(0);
    expect(afterContent.window, "document must not scroll").toBe(0);

    await page.locator("aside").evaluate((node) => {
      node.scrollTop = 300;
    });

    const afterAside = await offsets();
    expect(afterAside.aside).toBeGreaterThan(0);
    expect(afterAside.content, "content must keep its own position").toBe(
      afterContent.content,
    );
    expect(afterAside.window).toBe(0);
  });

  test("the document itself does not scroll on desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only shell");

    await page.setViewportSize({ height: 700, width: 1440 });
    await page.goto("/categories/electronics");

    const documentScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight + 1,
    );

    expect(documentScrolls).toBe(false);
  });

  test("the header responds to the content pane, not the window", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only shell");

    await page.setViewportSize({ height: 700, width: 1440 });
    await page.goto("/categories/electronics");

    const header = page.getByRole("banner");
    await expect(header).toHaveAttribute("data-state", "full");

    await page.locator("#app-scroll").evaluate((node) => {
      node.scrollTop = 800;
    });
    await expect(header).toHaveAttribute("data-state", "hidden");

    await page.locator("#app-scroll").evaluate((node) => {
      node.scrollTop = 400;
    });
    await expect(header).toHaveAttribute("data-state", "compact");

    await page.locator("#app-scroll").evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(header).toHaveAttribute("data-state", "full");
  });

  test("mobile keeps a single document scroll", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only");

    await page.goto("/categories/electronics");

    const documentScrolls = await page.evaluate(
      () =>
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight + 1,
    );

    expect(documentScrolls).toBe(true);
  });
});

test.describe("app shell geometry", () => {
  test("header starts after the sidebar, not across it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only");

    await page.setViewportSize({ height: 800, width: 1440 });
    await page.goto("/categories/electronics");

    const aside = await page.locator("aside").boundingBox();
    const banner = await page.getByRole("banner").boundingBox();

    expect(aside).not.toBeNull();
    expect(banner).not.toBeNull();

    expect(aside?.x, "sidebar flush to the left edge").toBe(0);
    expect(aside?.height, "sidebar spans the viewport").toBeGreaterThanOrEqual(790);

    expect(banner?.x, "header begins where the sidebar ends").toBeGreaterThanOrEqual(
      (aside?.x ?? 0) + (aside?.width ?? 0),
    );
  });
});
