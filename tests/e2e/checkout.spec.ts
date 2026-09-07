import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_EMAIL_DOMAIN } from "./global-teardown";

const GUEST_CART_KEY = "shopverse:guest-cart";
const SIMPLE_PRODUCT = "/products/ikea-markus-office-chair";

const ORDER_TIMEOUT_MS = 40_000;

async function addProduct(page: Page) {
  await page.goto(SIMPLE_PRODUCT);
  await page.getByRole("button", { name: /^Add .+ to cart$/ }).click();
  await expect(page.getByRole("link", { name: /^Cart, [1-9]/ })).toBeVisible();
}

async function fillDelivery(page: Page, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    address: "12 Adeola Odeku Street",
    city: "Victoria Island",
    email: `buyer@${E2E_EMAIL_DOMAIN}`,
    firstName: "Ada",
    lastName: "Obi",
    phone: "08031234567",
    ...overrides,
  };

  await page.getByLabel("First name", { exact: false }).fill(values.firstName!);
  await page.getByLabel("Last name", { exact: false }).fill(values.lastName!);
  await page.getByLabel("Email", { exact: false }).fill(values.email!);
  await page.getByLabel("Phone number", { exact: false }).fill(values.phone!);
  await page.getByLabel("Street address", { exact: false }).fill(values.address!);
  await page.getByLabel("City or town", { exact: false }).fill(values.city!);
}

function payButton(page: Page) {
  return page.getByRole("button", { name: /^(Pay |Continue to payment)/ });
}

async function chooseState(page: Page, state: string) {
  await page.getByRole("combobox", { name: /^State/ }).click();
  await page.getByRole("option", { name: state, exact: true }).click();
  await expect(payButton(page)).toHaveText(/^Pay /);
}

test.describe("checkout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.clear();
    }, GUEST_CART_KEY);
  });

  test("an empty cart cannot check out", async ({ page }) => {
    await page.goto("/checkout");

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop now" })).toBeVisible();
  });

  test("the cart links through to checkout once it is purchasable", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/cart");

    await page.getByRole("link", { name: "Proceed to checkout" }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
  });

  test("is not indexable", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const robots = page.locator('meta[name="robots"]');

    await expect(robots).toHaveAttribute("content", /noindex/);
    await expect(robots).toHaveAttribute("content", /nofollow/);
  });

  test("reviews the items being bought", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const review = page.getByRole("region", { name: "Review items" });

    await expect(review).toBeVisible();
    await expect(review.getByRole("listitem")).toHaveCount(1);
    await expect(review).toContainText("Quantity 1");
    await expect(review.getByRole("link", { name: "Edit cart" })).toBeVisible();
  });

  test("delivery is unknown until a state is chosen, then priced by the server", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const summary = page.getByRole("heading", { name: "Order summary" }).locator("..");

    await expect(summary).toContainText("Choose a state");

    await chooseState(page, "Lagos");
    await expect(summary).not.toContainText("Choose a state");

    const lagosTotal = await summary.textContent();

    await chooseState(page, "Borno");
    await expect(summary).not.toHaveText(lagosTotal ?? "");
  });

  test("required fields carry real labels and autocomplete", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const textFields: [string, string][] = [
      ["First name", "given-name"],
      ["Last name", "family-name"],
      ["Email", "email"],
      ["Phone number", "tel"],
      ["Street address", "street-address"],
      ["City or town", "address-level2"],
      ["Postal code", "postal-code"],
    ];

    for (const [label, autocomplete] of textFields) {
      await expect(
        page.getByLabel(label, { exact: false }),
        `${label} autocomplete`,
      ).toHaveAttribute("autocomplete", autocomplete);
    }

    const dropdowns: [string, string][] = [
      ["state", "address-level1"],
      ["country", "country"],
    ];

    for (const [name, autocomplete] of dropdowns) {
      await expect(
        page.locator(`input[name="${name}"]`),
        `${name} submitted field`,
      ).toHaveAttribute("autocomplete", autocomplete);
    }

    for (const label of ["State", "Country"]) {
      await expect(
        page.getByRole("combobox", { name: new RegExp(`^${label}`) }),
        `${label} is labelled`,
      ).toBeVisible();
    }
  });

  test("server validation reports field errors without wiping input", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page, { email: "not-an-email", phone: "12345" });
    await chooseState(page, "Lagos");

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText(/Nigerian phone number/)).toBeVisible();

    await expect(page.getByLabel("First name", { exact: false })).toHaveValue("Ada");
    await expect(page.getByLabel("Street address", { exact: false })).toHaveValue(
      "12 Adeola Odeku Street",
    );
    await expect(page.locator('input[name="state"]')).toHaveValue("Lagos");
    await expect(page.getByRole("combobox", { name: /^State/ })).toHaveText(/Lagos/);
  });

  test("errors are programmatically associated with their field", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page, { email: "not-an-email" });
    await chooseState(page, "Lagos");

    await page.waitForTimeout(2100);
    await payButton(page).click();

    const email = page.getByLabel("Email", { exact: false });

    await expect(email).toHaveAttribute("aria-invalid", "true");

    const describedBy = await email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    await expect(page.locator(`#${describedBy!.split(" ").pop()}`)).toContainText(
      "Enter a valid email address",
    );
  });

  test("a submission that is too fast is rejected", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>(
        'input[name="rendered_at"]',
      );

      if (field) {
        field.value = String(Date.now());
      }
    });

    await payButton(page).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /could not start your checkout/i,
    );
    await expect(page.getByRole("heading", { name: /^Order SV-/ })).toBeHidden();
  });

  test("a valid submission passes server validation", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await page.waitForURL(/checkout\.paystack\.com/, { timeout: ORDER_TIMEOUT_MS });

    expect(page.url()).toMatch(/^https:\/\/checkout\.paystack\.com\/[A-Za-z0-9]+$/);
  });

  test("resubmitting the same checkout attempt replays one order (PAY-01)", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await page.waitForURL(/checkout\.paystack\.com/, { timeout: ORDER_TIMEOUT_MS });

    const first = page.url();

    await page.goBack();
    await expect(payButton(page)).toBeVisible({ timeout: ORDER_TIMEOUT_MS });

    await fillDelivery(page);
    await chooseState(page, "Lagos");
    await page.waitForTimeout(2100);
    await payButton(page).click();

    await page.waitForURL(/checkout\.paystack\.com/, { timeout: ORDER_TIMEOUT_MS });

    expect(page.url()).toBe(first);
  });

  test("refuses an order whose total the customer never saw (CART-01)", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>(
        'input[name="acknowledgedTotal"]',
      );

      if (field) {
        field.value = "1";
      }
    });

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await expect(page.getByRole("heading", { name: "The total changed" })).toBeVisible({
      timeout: ORDER_TIMEOUT_MS,
    });
    await expect(page.getByRole("heading", { name: /^Order SV-/ })).toBeHidden();
  });

  test("the acknowledged total is sent and matches the summary", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    const sent = await page
      .locator('input[name="acknowledgedTotal"]')
      .getAttribute("value");

    const summary = await page
      .getByRole("heading", { name: "Order summary" })
      .locator("..")
      .innerText();

    const naira = Number(sent) / 100;

    expect(summary).toContain(naira.toLocaleString("en-NG"));
  });

  test("a filled honeypot is rejected", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page);
    await chooseState(page, "Lagos");

    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>(
        'input[name="delivery_reference"]',
      );

      if (field) {
        field.value = "bot was here";
      }
    });

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /could not start your checkout/i,
    );
    await expect(page.getByRole("heading", { name: /^Order SV-/ })).toBeHidden();
  });

  test("the honeypot is hidden from assistive technology and tab order", async ({
    page,
  }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const honeypot = page.locator('input[name="delivery_reference"]');

    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).toHaveAttribute("autocomplete", "off");

    const hidden = await honeypot.evaluate(
      (node) => node.closest("[aria-hidden='true']") !== null,
    );

    expect(hidden).toBe(true);
  });

  test("a checkout attempt id survives a reload", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const first = await page
      .locator('input[name="checkoutAttemptId"]')
      .getAttribute("value");

    expect(first).toMatch(/^[0-9a-f-]{36}$/);

    await page.reload();

    const second = await page
      .locator('input[name="checkoutAttemptId"]')
      .getAttribute("value");

    expect(second).toBe(first);
  });

  test("the submitted cart lines carry no money fields (CART-07)", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    const raw = await page.locator('input[name="lines"]').getAttribute("value");
    const lines = JSON.parse(raw ?? "[]") as Record<string, unknown>[];

    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0] ?? {}).sort()).toStrictEqual([
      "productId",
      "quantity",
      "variantId",
    ]);
  });

  test("a cart that went out of stock blocks checkout", async ({ page }) => {
    await addProduct(page);

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

    await page.goto("/checkout");

    await expect(
      page.getByRole("heading", { name: "Your cart needs attention" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to cart" })).toBeVisible();
  });

  test("a failed cart check refuses to start checkout", async ({ page }) => {
    await addProduct(page);

    await page.route("**/api/cart/validate", (route) => route.abort());
    await page.goto("/checkout");

    await expect(
      page.getByRole("heading", { name: "Could not check your cart" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("has no detectable axe violations", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });

  test("has no detectable axe violations while showing errors", async ({ page }) => {
    await addProduct(page);
    await page.goto("/checkout");

    await fillDelivery(page, { email: "not-an-email" });
    await chooseState(page, "Lagos");

    await page.waitForTimeout(2100);
    await payButton(page).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.map((violation) => violation.id)).toStrictEqual([]);
  });
});
