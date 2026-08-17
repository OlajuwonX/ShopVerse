import { describe, expect, it } from "vitest";

import { buildSku, slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Samsung Galaxy S24 Ultra")).toBe("samsung-galaxy-s24-ultra");
  });

  it("strips diacritics and punctuation", () => {
    expect(slugify("Café Crème 100%")).toBe("cafe-creme-100");
    expect(slugify("The Ordinary Niacinamide 10% + Zinc 1%")).toBe(
      "the-ordinary-niacinamide-10-zinc-1",
    );
  });

  it("never leaves leading or trailing hyphens", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
    expect(slugify("!!!")).toBe("");
  });

  it("caps length without leaving a trailing hyphen", () => {
    const slug = slugify("a".repeat(120));

    expect(slug.length).toBeLessThanOrEqual(96);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when it is free", () => {
    expect(uniqueSlug("Adidas Samba OG", new Set())).toBe("adidas-samba-og");
  });

  it("disambiguates deterministically", () => {
    const taken = new Set(["adidas-samba-og"]);

    expect(uniqueSlug("Adidas Samba OG", taken)).toBe("adidas-samba-og-2");
    expect(
      uniqueSlug("Adidas Samba OG", new Set([...taken, "adidas-samba-og-2"])),
    ).toBe("adidas-samba-og-3");
  });

  it("falls back to a stable value when the name has no slug characters", () => {
    expect(uniqueSlug("!!!", new Set())).toBe("item");
  });

  it("is a pure function of its inputs, so identical input yields identical output", () => {
    const first = uniqueSlug("Ikea Kivik 3-Seat Sofa", new Set());
    const second = uniqueSlug("Ikea Kivik 3-Seat Sofa", new Set());

    expect(first).toBe(second);
  });
});

describe("seed slug assignment (DATA-07 regression)", () => {
  function assignSlugs(names: readonly string[]) {
    const taken = new Set<string>();
    const assigned = new Map<string, string>();

    for (const name of names) {
      const slug = uniqueSlug(name, taken);
      taken.add(slug);
      assigned.set(name, slug);
    }

    return assigned;
  }

  const names = [
    "Adidas Samba OG",
    "Ikea Kivik 3-Seat Sofa",
    "Adidas Ultraboost Light",
  ];

  it("produces the same slugs on every run for the same input set", () => {
    expect([...assignSlugs(names)]).toStrictEqual([...assignSlugs(names)]);
  });

  it("does not drift when the same names are assigned repeatedly", () => {
    const runs = [assignSlugs(names), assignSlugs(names), assignSlugs(names)];

    for (const run of runs) {
      expect(run.get("Adidas Samba OG")).toBe("adidas-samba-og");
    }
  });

  it("only suffixes when the seed set itself repeats a name", () => {
    const assigned = assignSlugs(["Adidas Samba OG", "Adidas Samba OG"]);

    expect(assigned.size).toBe(1);
    expect(uniqueSlug("Adidas Samba OG", new Set(["adidas-samba-og"]))).toBe(
      "adidas-samba-og-2",
    );
  });
});

describe("buildSku", () => {
  it("joins uppercased parts", () => {
    expect(buildSku(["Samsung Galaxy S24 Ultra", "256GB"])).toBe(
      "SAMSUNG-GALAXY-S24-ULTRA-256GB",
    );
  });

  it("does not collide for products sharing a prefix", () => {
    const first = buildSku(["Samsung Galaxy S24 Ultra", "256GB"]);
    const second = buildSku(["Samsung Galaxy Tab S9 FE", "256GB"]);

    expect(first).not.toBe(second);
  });

  it("drops empty parts", () => {
    expect(buildSku(["Product", "", "!!!"])).toBe("PRODUCT");
  });
});
