import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/categories/electronics",
  "/products/samsung-galaxy-s24-ultra",
  "/search?q=phone",
  "/wishlist",
  "/cart",
  "/checkout",
];

function directives(policy: string) {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);

        return [name!, values.join(" ")] as const;
      }),
  );
}

test("every response carries the security headers", async ({ request }) => {
  for (const route of ROUTES) {
    const response = await request.get(route);
    const headers = response.headers();

    expect(headers["content-security-policy"], route).toBeTruthy();
    expect(headers["x-content-type-options"], route).toBe("nosniff");
    expect(headers["x-frame-options"], route).toBe("DENY");
    expect(headers["referrer-policy"], route).toBe("strict-origin-when-cross-origin");
  }
});

test("the policy restricts the directives that matter", async ({ request }) => {
  const response = await request.get("/");
  const policy = directives(response.headers()["content-security-policy"] ?? "");

  // Without these, an injected script can load its payload, exfiltrate over fetch,
  // or post a forged form off-origin.
  expect(policy.get("default-src")).toBe("'self'");
  expect(policy.get("form-action")).toBe("'self'");
  expect(policy.get("object-src")).toBe("'none'");
  expect(policy.get("base-uri")).toBe("'self'");
  expect(policy.get("frame-ancestors")).toBe("'none'");
  expect(policy.get("frame-src")).toBe("'none'");

  expect(policy.get("connect-src"), "exfiltration channel").not.toContain("*");
  expect(policy.get("script-src"), "no wildcard script source").not.toContain("*");
  expect(policy.get("script-src")).toContain("'self'");
});

test("external script and connect origins are not allowed", async ({ request }) => {
  const response = await request.get("/");
  const policy = response.headers()["content-security-policy"] ?? "";

  for (const forbidden of ["https://evil.example", "http:", "*"]) {
    expect(policy, `script-src must not allow ${forbidden}`).not.toContain(
      `script-src 'self' 'unsafe-inline' ${forbidden}`,
    );
  }
});

async function cspViolations(page: Page, route: string) {
  const violations: string[] = [];

  page.on("console", (message) => {
    const text = message.text();

    if (/content security policy|refused to (load|execute|connect|apply)/i.test(text)) {
      violations.push(`${route}: ${text.slice(0, 160)}`);
    }
  });

  await page.goto(route);
  await page.waitForLoadState("networkidle");

  return violations;
}

test("no route is broken by the policy", async ({ page }) => {
  const all: string[] = [];

  for (const route of ROUTES) {
    all.push(...(await cspViolations(page, route)));
  }

  for (const violation of all) {
    console.log(`CSP VIOLATION ${violation}`);
  }

  expect(all, "enforcing the policy must not break any page").toStrictEqual([]);
});

test("interactive flows still work under the policy", async ({ page }) => {
  await page.goto("/products/ikea-markus-office-chair");

  const violations: string[] = [];

  page.on("console", (message) => {
    if (/content security policy|refused to/i.test(message.text())) {
      violations.push(message.text().slice(0, 160));
    }
  });

  await page.getByRole("button", { name: /^Add .+ to cart$/ }).click();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("combobox", { name: /search/i }).fill("phone");
  await expect(page.getByRole("listbox")).toBeVisible();

  expect(violations, "add to cart and search must survive the policy").toStrictEqual(
    [],
  );
});
