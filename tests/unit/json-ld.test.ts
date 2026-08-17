import { describe, expect, it } from "vitest";

import { buildBreadcrumbJsonLd, serialiseJsonLd } from "@/components/seo/JsonLd";

const ORIGIN = "https://shopverse.example";

describe("serialiseJsonLd (SEC-06)", () => {
  it("escapes angle brackets so a payload cannot close the script tag", () => {
    const output = serialiseJsonLd({ name: "</script><script>alert(1)</script>" });

    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<");
    expect(output).toContain("\\u003c");
  });

  it("escapes ampersands", () => {
    expect(serialiseJsonLd({ name: "Bed & Bath" })).toContain("\\u0026");
  });

  it("escapes the JavaScript line separators", () => {
    const output = serialiseJsonLd({
      name: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`,
    });

    expect(output).toContain("\\u2028");
    expect(output).toContain("\\u2029");
  });

  it("leaves ordinary spaces and text untouched", () => {
    const output = serialiseJsonLd({ name: "Samsung Galaxy S24 Ultra" });

    expect(output).toContain("Samsung Galaxy S24 Ultra");
  });

  it("still parses back to the original data", () => {
    const data = { name: "Bed & Bath", nested: { list: [1, 2, 3] } };
    const parsed: unknown = JSON.parse(serialiseJsonLd(data));

    expect(parsed).toStrictEqual(data);
  });

  it("round-trips a hostile product name without losing it", () => {
    const name = '<img src=x onerror=alert(1)> & "quoted"';
    const parsed = JSON.parse(serialiseJsonLd({ name })) as { name: string };

    expect(parsed.name).toBe(name);
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("matches the visible breadcrumb positions", () => {
    const data = buildBreadcrumbJsonLd(
      [
        { href: "/", label: "Home" },
        { href: "/categories/electronics", label: "Electronics" },
        { label: "Smartphones" },
      ],
      ORIGIN,
    );

    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement.map((item) => item.position)).toStrictEqual([1, 2, 3]);
    expect(data.itemListElement.map((item) => item.name)).toStrictEqual([
      "Home",
      "Electronics",
      "Smartphones",
    ]);
  });

  it("emits absolute urls for linked crumbs", () => {
    const data = buildBreadcrumbJsonLd(
      [{ href: "/categories/electronics", label: "Electronics" }],
      ORIGIN,
    );

    expect(data.itemListElement[0]).toMatchObject({
      item: "https://shopverse.example/categories/electronics",
    });
  });

  it("omits the url for the current page, which has no href", () => {
    const data = buildBreadcrumbJsonLd([{ label: "Smartphones" }], ORIGIN);

    expect(data.itemListElement[0]).not.toHaveProperty("item");
  });

  it("produces script-safe output end to end", () => {
    const data = buildBreadcrumbJsonLd([{ label: "</script>" }], ORIGIN);

    expect(serialiseJsonLd(data)).not.toContain("</script>");
  });
});
