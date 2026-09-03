import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CATEGORY = "/categories/smartphones";

function sort(page: Page) {
  return page.getByRole("combobox", { name: /^Sort/ });
}

async function openSort(page: Page) {
  await page.goto(CATEGORY);
  const trigger = sort(page);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  return trigger;
}

test.describe("custom select", () => {
  test("exposes combobox semantics before it is opened", async ({ page }) => {
    await page.goto(CATEGORY);
    const trigger = sort(page);

    await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("opens a listbox whose options carry the selected state", async ({ page }) => {
    await openSort(page);

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();

    const options = listbox.getByRole("option");
    await expect(options).toHaveCount(5);
    await expect(listbox.getByRole("option", { selected: true })).toHaveCount(1);
  });

  test("selects with the keyboard and closes", async ({ page }) => {
    await page.goto(CATEGORY);
    const trigger = sort(page);

    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("tracks the active option with aria-activedescendant", async ({ page }) => {
    const trigger = await openSort(page);

    const active = await trigger.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();

    await page.keyboard.press("ArrowDown");
    const moved = await trigger.getAttribute("aria-activedescendant");

    expect(moved).toBeTruthy();
    expect(moved).not.toEqual(active);
    await expect(page.locator(`#${moved}`)).toHaveAttribute("role", "option");
  });

  test("Escape closes without changing the value", async ({ page }) => {
    await page.goto(CATEGORY);
    const trigger = sort(page);
    const before = await trigger.textContent();

    await trigger.click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveText(before ?? "");
    await expect(trigger).toBeFocused();
  });

  test("clicking outside closes the listbox", async ({ page }) => {
    await openSort(page);

    await page.getByRole("heading", { level: 1 }).click();

    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(sort(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("choosing an option updates the trigger and the url", async ({ page }) => {
    await openSort(page);

    await page.getByRole("option", { name: "Price: low to high" }).click();

    await expect(sort(page)).toHaveText(/Price: low to high/);
    await expect(page).toHaveURL(/sort=price_asc/);
  });

  test("has no detectable axe violations while open", async ({ page }) => {
    await openSort(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toStrictEqual([]);
  });
});
