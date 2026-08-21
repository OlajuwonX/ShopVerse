import { expect, test } from "@playwright/test";

test.describe("search combobox", () => {
  test("exposes combobox semantics to the accessibility tree", async ({ page }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });

    await expect(combobox).toBeVisible();
    await expect(combobox).toHaveAttribute("aria-expanded", "false");
    await expect(combobox).toHaveAttribute("aria-autocomplete", "list");
  });

  test("opens a listbox of suggestions after debounce and marks the active option", async ({
    page,
  }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.fill("galaxy");

    const listbox = page.getByRole("listbox", { name: /search suggestions/i });
    await expect(listbox).toBeVisible();

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    await expect(combobox).toHaveAttribute("aria-expanded", "true");
    await expect(combobox).not.toHaveAttribute("aria-activedescendant", /.+/);

    await combobox.press("ArrowDown");

    const activeId = await combobox.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();

    await expect(page.locator(`#${activeId}`)).toHaveAttribute("aria-selected", "true");
  });

  test("arrow keys wrap around the option list", async ({ page }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.fill("galaxy");
    await expect(page.getByRole("option").first()).toBeVisible();

    const count = await page.getByRole("option").count();

    await combobox.press("ArrowUp");
    const last = await combobox.getAttribute("aria-activedescendant");
    expect(last).toContain(`option-${count - 1}`);

    await combobox.press("ArrowDown");
    const first = await combobox.getAttribute("aria-activedescendant");
    expect(first).toContain("option-0");
  });

  test("Escape closes the panel without navigating", async ({ page }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.fill("galaxy");
    await expect(page.getByRole("listbox")).toBeVisible();

    await combobox.press("Escape");

    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(page).toHaveURL("/");
  });

  test("Enter on the raw term navigates to the results page", async ({ page }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.fill("galaxy");
    await combobox.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=galaxy/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("galaxy");
  });

  test("a term below the minimum length issues no suggestion request", async ({
    page,
  }) => {
    const requests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/search/suggestions")) {
        requests.push(request.url());
      }
    });

    await page.goto("/");
    await page.getByRole("combobox", { name: /search anything/i }).fill("g");
    await page.waitForTimeout(800);

    expect(requests).toEqual([]);
  });

  test("rapid typing debounces to a single in-flight term", async ({ page }) => {
    const terms: string[] = [];

    page.on("request", (request) => {
      const url = request.url();

      if (url.includes("/api/search/suggestions")) {
        terms.push(new URL(url).searchParams.get("q") ?? "");
      }
    });

    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.pressSequentially("galaxy", { delay: 40 });
    await page.waitForTimeout(1_000);

    expect(terms.length).toBeLessThanOrEqual(2);
    expect(terms.at(-1)).toBe("galaxy");
  });

  test("recent searches persist and reappear on a later visit", async ({ page }) => {
    await page.goto("/");

    const combobox = page.getByRole("combobox", { name: /search anything/i });
    await combobox.fill("galaxy");
    await combobox.press("Enter");
    await expect(page).toHaveURL(/\/search/);

    await page.goto("/");
    await page.getByRole("combobox", { name: /search anything/i }).click();

    await expect(page.getByText("Recent searches")).toBeVisible();
    await expect(page.getByRole("option", { name: /galaxy/i }).first()).toBeVisible();
  });
});
