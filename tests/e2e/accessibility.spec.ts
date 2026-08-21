import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SURFACES = [
  { name: "home", path: "/" },
  { name: "category", path: "/categories/electronics" },
  { name: "nested category", path: "/categories/smartphones" },
  { name: "product", path: "/products/adidas-samba-og" },
  { name: "search results", path: "/search?q=galaxy" },
  { name: "search zero results", path: "/search?q=zzzznotfound" },
];

for (const surface of SURFACES) {
  test(`${surface.name} has no detectable axe violations`, async ({ page }) => {
    await page.goto(surface.path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      target: violation.nodes[0]?.target?.join(" "),
    }));

    expect(summary).toEqual([]);
  });
}

test("every page exposes exactly one main landmark and one h1", async ({ page }) => {
  for (const surface of SURFACES) {
    await page.goto(surface.path);

    await expect(page.getByRole("main"), `${surface.name} main landmark`).toHaveCount(
      1,
    );
    await expect(
      page.getByRole("heading", { level: 1 }),
      `${surface.name} h1`,
    ).toHaveCount(1);
  }
});

test("landmarks have unique accessible names", async ({ page }) => {
  await page.goto("/categories/smartphones");

  const navNames = await page
    .getByRole("navigation")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") ?? ""));

  expect(navNames.length).toBeGreaterThan(1);
  expect(new Set(navNames).size).toBe(navNames.length);
  expect(navNames.every((name) => name.length > 0)).toBe(true);
});

test("the skip link is the first tab stop and moves focus to main", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: /skip to content/i });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});
