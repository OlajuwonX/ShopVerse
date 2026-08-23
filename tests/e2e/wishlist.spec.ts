import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const GUEST_WISHLIST_KEY = "shopverse:guest-wishlist";
const PRODUCT = "/products/adidas-samba-og";

function saveButton(page: Page) {
  return page.getByRole("button", { name: /^Save .+ to wishlist$/ });
}

function removeButton(page: Page) {
  return page.getByRole("button", { name: /^Remove .+ from wishlist$/ });
}

async function readStoredWishlist(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), GUEST_WISHLIST_KEY);
}

test.describe("guest wishlist", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, GUEST_WISHLIST_KEY);
  });

  test("starts with an empty state that offers a next action", async ({ page }) => {
    await page.goto("/wishlist");

    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse products" })).toBeVisible();
  });

  test("the header wishlist link reflects the saved count", async ({ page }) => {
    await page.goto("/");

    const link = page.getByRole("link", { name: /^Wishlist,/ });
    await expect(link).toHaveAccessibleName("Wishlist, nothing saved");

    await saveButton(page).first().click();

    await expect(link).toHaveAccessibleName("Wishlist, 1 saved product");
  });

  test("stores identifiers only, never product data (WISH-01)", async ({ page }) => {
    await page.goto("/");
    await saveButton(page).first().click();

    const raw = await readStoredWishlist(page);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? "null") as { items: unknown; version: number };

    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items as string[]).toHaveLength(1);
    expect(typeof (parsed.items as string[])[0]).toBe("string");
    expect(raw).not.toMatch(/price|name|slug|image/i);
  });

  test("a saved product is hydrated from the server on the wishlist page", async ({
    page,
  }) => {
    await page.goto("/");

    const firstCardName = await page
      .getByRole("main")
      .getByRole("heading", { level: 3 })
      .first()
      .textContent();

    await saveButton(page).first().click();
    await page.getByRole("link", { name: /^Wishlist,/ }).click();

    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.getByRole("heading", { name: "Saved products" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Saved products" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: (firstCardName ?? "").trim() }),
    ).toBeVisible();
  });

  test("the toggle is pressed on the product page and survives a reload", async ({
    page,
  }) => {
    await page.goto(PRODUCT);

    const save = page.getByRole("button", { name: "Save for later" });
    await expect(save).toHaveAttribute("aria-pressed", "false");

    await save.click();

    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.reload();

    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("removing the last product returns the empty state", async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole("button", { name: "Save for later" }).click();

    await page.goto("/wishlist");
    await expect(page.getByRole("list", { name: "Saved products" })).toBeVisible();

    await removeButton(page).first().click();

    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
  });

  test("a wishlist of identifiers with no live product prunes itself (WISH-04)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ([key, payload]) => {
        window.localStorage.setItem(key!, payload!);
      },
      [
        GUEST_WISHLIST_KEY,
        JSON.stringify({
          items: ["00000000-0000-4000-8000-000000000000"],
          version: 1,
        }),
      ],
    );

    await page.goto("/wishlist");

    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
    await expect
      .poll(() => readStoredWishlist(page), { timeout: 5000 })
      .toBe(JSON.stringify({ items: [], version: 1 }));
  });

  test("corrupt stored data is discarded rather than thrown (WISH-01)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.setItem(key, "{ not json");
    }, GUEST_WISHLIST_KEY);

    await page.goto("/wishlist");

    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Wishlist,/ })).toHaveAccessibleName(
      "Wishlist, nothing saved",
    );
  });

  test("a save made in another tab appears without a reload", async ({ page }) => {
    await page.goto("/wishlist");
    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();

    await page.evaluate(
      ([key, payload]) => {
        window.localStorage.setItem(key!, payload!);
        window.dispatchEvent(
          new StorageEvent("storage", { key: key!, newValue: payload! }),
        );
      },
      [
        GUEST_WISHLIST_KEY,
        JSON.stringify({
          items: ["00000000-0000-4000-8000-000000000000"],
          version: 1,
        }),
      ],
    );

    await expect(page.getByRole("link", { name: /^Wishlist,/ })).toHaveAccessibleName(
      "Wishlist, 1 saved product",
    );
  });

  test("a failed hydration keeps the saved products and offers a retry", async ({
    page,
  }) => {
    await page.goto(PRODUCT);
    await page.getByRole("button", { name: "Save for later" }).click();

    await page.route("**/api/wishlist**", (route) => route.abort());
    await page.goto("/wishlist");

    await expect(
      page.getByRole("heading", { name: "Could not load your wishlist" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Wishlist,/ })).toHaveAccessibleName(
      "Wishlist, 1 saved product",
    );
  });

  test("the hydration endpoint ignores identifiers that are not uuids", async ({
    request,
  }) => {
    const response = await request.get("/api/wishlist?ids=not-a-uuid,../../etc/passwd");

    expect(response.status()).toBe(200);
    expect(await response.json()).toStrictEqual({ items: [] });
  });

  test("has no detectable axe violations when empty", async ({ page }) => {
    await page.goto("/wishlist");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });

  test("has no detectable axe violations when populated", async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole("button", { name: "Save for later" }).click();
    await page.goto("/wishlist");

    await expect(page.getByRole("list", { name: "Saved products" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });
});
