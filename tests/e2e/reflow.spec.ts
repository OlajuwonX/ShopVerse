import { expect, test, type Page } from "@playwright/test";

/**
 * WCAG 1.4.4 (Resize Text) and 1.4.10 (Reflow): content must not require horizontal
 * scrolling at 320px, nor when a reader scales text to 200%. Layouts that key only on
 * viewport width pass the first and fail the second, which is exactly what audit finding
 * M-3 caught — axe cannot see it because axe does not simulate text scaling.
 */

const ROUTES = ["/", "/categories/electronics", "/cart", "/checkout", "/wishlist"];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;

    if (doc.scrollWidth <= doc.clientWidth + 1) {
      return null;
    }

    const offenders: string[] = [];

    for (const node of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const rect = node.getBoundingClientRect();

      if (rect.width === 0 || rect.right <= window.innerWidth + 1) {
        continue;
      }

      // A rail that scrolls sideways on purpose is not a reflow failure.
      let parent = node.parentElement;
      let insideScroller = false;

      while (parent) {
        const overflowX = getComputedStyle(parent).overflowX;

        if (overflowX === "auto" || overflowX === "scroll") {
          insideScroller = true;
          break;
        }

        parent = parent.parentElement;
      }

      if (!insideScroller) {
        offenders.push(`${node.tagName.toLowerCase()} right=${Math.round(rect.right)}`);
      }
    }

    return {
      client: doc.clientWidth,
      offenders: [...new Set(offenders)].slice(0, 5),
      scroll: doc.scrollWidth,
    };
  });
}

async function seedCart(page: Page) {
  await page.goto("/products/ikea-markus-office-chair");

  const add = page.getByRole("button", { name: /^Add .+ to cart$/ });

  if (await add.count()) {
    await add.first().click();
  }
}

test("no horizontal scrolling at 320px", async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 320 });
  await seedCart(page);

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    expect(await horizontalOverflow(page), `${route} at 320px`).toBeNull();
  }
});

test("no horizontal scrolling at 200% text scale", async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 640 });
  await seedCart(page);

  for (const route of ROUTES) {
    await page.goto(route);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    await page.waitForTimeout(250);

    expect(await horizontalOverflow(page), `${route} at 200% text`).toBeNull();
  }
});
