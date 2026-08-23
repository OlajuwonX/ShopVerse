import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const GUEST_CART_KEY = "shopverse:guest-cart";
const SIMPLE_PRODUCT = "/products/ikea-markus-office-chair";
const VARIANT_PRODUCT = "/products/samsung-galaxy-s24-ultra";

async function readStoredCart(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), GUEST_CART_KEY);
}

function cartItems(page: Page) {
  return page.getByRole("region", { name: "Items in your cart" }).getByRole("listitem");
}

async function addSimpleProduct(page: Page) {
  await page.goto(SIMPLE_PRODUCT);
  await page.getByRole("button", { name: /^Add .+ to cart$/ }).click();
}

test.describe("guest cart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, GUEST_CART_KEY);
  });

  test("starts empty with a next action", async ({ page }) => {
    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop now" })).toBeVisible();
  });

  test("the header cart reflects the item count", async ({ page }) => {
    await page.goto("/");

    const link = page.getByRole("link", { name: /^Cart,/ });
    await expect(link).toHaveAccessibleName("Cart, empty");

    await addSimpleProduct(page);

    await expect(link).toHaveAccessibleName("Cart, 1 item");
  });

  test("stores intent only, never prices the server would trust (CART-07)", async ({
    page,
  }) => {
    await addSimpleProduct(page);

    const raw = await readStoredCart(page);
    const parsed = JSON.parse(raw ?? "null") as {
      lines: Record<string, unknown>[];
      version: number;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.lines).toHaveLength(1);
    expect(Object.keys(parsed.lines[0] ?? {}).sort()).toStrictEqual([
      "lastSeenUnitPrice",
      "productId",
      "quantity",
      "variantId",
    ]);

    const posted: unknown[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/cart/validate") && request.method() === "POST") {
        posted.push(request.postDataJSON());
      }
    });

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();

    expect(posted).toHaveLength(1);
    expect(JSON.stringify(posted)).not.toContain("lastSeenUnitPrice");
    expect(
      (posted[0] as { lines: Record<string, unknown>[] }).lines.every(
        (line) => Object.keys(line).sort().join(",") === "productId,quantity,variantId",
      ),
    ).toBe(true);
  });

  test("prices and totals come from the server", async ({ page }) => {
    await addSimpleProduct(page);
    await page.goto("/cart");

    const summary = page.getByRole("heading", { name: "Order summary" }).locator("..");

    await expect(summary).toContainText("Subtotal");
    await expect(summary).toContainText("₦");
    await expect(summary).toContainText("Calculated at checkout");
  });

  test("quantity controls update the line and the totals", async ({ page }) => {
    await addSimpleProduct(page);
    await page.goto("/cart");

    const increase = page.getByRole("button", { name: /^Increase quantity of/ });
    await expect(increase).toBeVisible();

    await increase.click();

    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 2 items",
    );

    const decrease = page.getByRole("button", { name: /^Decrease quantity of/ });
    await decrease.click();

    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 1 item",
    );
  });

  test("removing the last line returns the empty state", async ({ page }) => {
    await addSimpleProduct(page);
    await page.goto("/cart");

    await page.getByRole("button", { name: /^Remove .+ from cart$/ }).click();

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("a product with variants asks for a choice before offering the cart", async ({
    page,
  }) => {
    await page.goto(VARIANT_PRODUCT);

    const options = page.getByRole("button", { name: /GB|TB/ });

    test.skip((await options.count()) < 2, "no selectable variants in the seed");

    await expect(
      page.getByRole("button", { name: /choose options for/i }).first(),
    ).toBeVisible();

    await options.first().click();

    await expect(
      page.getByRole("button", { name: /^Add .+ to cart$/ }).first(),
    ).toBeVisible();
  });

  test("adding the same variant twice increases the quantity, not the line count", async ({
    page,
  }) => {
    await addSimpleProduct(page);
    await page.getByRole("button", { name: /^Add .+ to cart$/ }).click();

    await page.goto("/cart");

    await expect(cartItems(page)).toHaveCount(1);
    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 2 items",
    );
  });

  test("a price change is surfaced and gated behind acknowledgement (CART-01)", async ({
    page,
  }) => {
    await addSimpleProduct(page);

    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw ?? "null") as {
        lines: { lastSeenUnitPrice: number | null }[];
        version: number;
      };

      parsed.lines[0]!.lastSeenUnitPrice = 1;
      window.localStorage.setItem(key, JSON.stringify(parsed));
    }, GUEST_CART_KEY);

    await page.goto("/cart");

    await expect(page.getByText(/price changed from/i)).toBeVisible();
    await expect(page.getByText(/accept the new prices/i)).toBeVisible();

    await page.getByRole("button", { name: "Accept new prices" }).click();

    await expect(page.getByText(/price changed from/i)).toBeHidden();
  });

  test("a deleted product is explained and the rest of the cart survives (CART-02)", async ({
    page,
  }) => {
    await addSimpleProduct(page);

    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw ?? "null") as {
        lines: Record<string, unknown>[];
        version: number;
      };

      parsed.lines.push({
        lastSeenUnitPrice: null,
        productId: "00000000-0000-4000-8000-000000000000",
        quantity: 1,
        variantId: "00000000-0000-4000-8000-000000000001",
      });

      window.localStorage.setItem(key, JSON.stringify(parsed));
    }, GUEST_CART_KEY);

    await page.goto("/cart");

    await expect(page.getByText(/no longer available/i).first()).toBeVisible();
    await expect(cartItems(page)).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
    await expect(page.getByText(/cannot be ordered/i)).toBeVisible();
  });

  test("corrupt storage is discarded rather than thrown (CART-06)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.setItem(key, "{ not json");
    }, GUEST_CART_KEY);

    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, empty",
    );
  });

  test("a hand-edited quantity beyond the cap is rejected on read (CART-08)", async ({
    page,
  }) => {
    await addSimpleProduct(page);

    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw ?? "null") as {
        lines: { quantity: number }[];
        version: number;
      };

      parsed.lines[0]!.quantity = 9999;
      window.localStorage.setItem(key, JSON.stringify(parsed));
    }, GUEST_CART_KEY);

    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("an addition in another tab appears without a reload (CART-05)", async ({
    page,
  }) => {
    await addSimpleProduct(page);
    const raw = await readStoredCart(page);

    await page.goto("/cart");
    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 1 item",
    );

    await page.evaluate(
      ([key, payload]) => {
        const parsed = JSON.parse(payload!) as { lines: { quantity: number }[] };

        parsed.lines[0]!.quantity = 3;

        const next = JSON.stringify(parsed);

        window.localStorage.setItem(key!, next);
        window.dispatchEvent(
          new StorageEvent("storage", { key: key!, newValue: next }),
        );
      },
      [GUEST_CART_KEY, raw],
    );

    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 3 items",
    );
  });

  test("a failed validation keeps the cart and offers a retry", async ({ page }) => {
    await addSimpleProduct(page);

    await page.route("**/api/cart/validate", (route) => route.abort());
    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { name: "Could not check your cart" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
      "Cart, 1 item",
    );
  });

  test("the validation endpoint rejects a body it cannot trust", async ({
    request,
  }) => {
    const badShape = await request.post("/api/cart/validate", {
      data: { lines: [{ productId: "nope", quantity: 1, variantId: "nope" }] },
    });
    expect(badShape.status()).toBe(400);

    const negative = await request.post("/api/cart/validate", {
      data: {
        lines: [
          {
            productId: "00000000-0000-4000-8000-000000000000",
            quantity: -5,
            variantId: "00000000-0000-4000-8000-000000000001",
          },
        ],
      },
    });
    expect(negative.status()).toBe(400);

    const notJson = await request.post("/api/cart/validate", { data: "nope" });
    expect(notJson.status()).toBe(400);
  });

  test("the validation endpoint ignores client-supplied money fields (CART-07)", async ({
    request,
  }) => {
    const response = await request.post("/api/cart/validate", {
      data: {
        lines: [
          {
            lineTotal: 1,
            productId: "00000000-0000-4000-8000-000000000000",
            quantity: 1,
            unitPrice: 1,
            variantId: "00000000-0000-4000-8000-000000000001",
          },
        ],
        totals: { subtotal: 1, total: 1 },
      },
    });

    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      lines: { unitPrice: number }[];
      totals: { subtotal: number; total: number };
    };

    expect(body.totals.subtotal).toBe(0);
    expect(body.totals.total).toBe(0);
    expect(body.lines[0]?.unitPrice).toBe(0);
  });

  test("has no detectable axe violations when empty", async ({ page }) => {
    await page.goto("/cart");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });

  test("has no detectable axe violations when populated", async ({ page }) => {
    await addSimpleProduct(page);
    await page.goto("/cart");

    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });
});
