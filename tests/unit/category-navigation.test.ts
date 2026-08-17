import { describe, expect, it } from "vitest";

import {
  activeBranchIds,
  buildCategoryBreadcrumbs,
  findCategoryPath,
  resolveCategoryRail,
  topLevelCategories,
} from "@/features/categories/navigation";
import { categoryHref, productHref } from "@/lib/routes";
import type { CategoryNode } from "@/server/services/categories";

function node(slug: string, children: CategoryNode[] = [], depth = 0): CategoryNode {
  return {
    children,
    depth,
    description: null,
    icon: null,
    id: `id-${slug}`,
    name: slug.replace(/-/g, " "),
    parentId: null,
    slug,
    sortOrder: 0,
  };
}

const tree: CategoryNode[] = [
  node("electronics", [node("phones", [node("smartphones", [], 2)], 1)]),
  node("furniture", [node("seating", [], 1)]),
];

describe("route builders", () => {
  it("builds canonical catalogue paths", () => {
    expect(categoryHref("smartphones")).toBe("/categories/smartphones");
    expect(productHref("galaxy-s24")).toBe("/products/galaxy-s24");
  });
});

describe("findCategoryPath", () => {
  it("finds a root category", () => {
    expect(findCategoryPath(tree, "electronics").map((n) => n.slug)).toStrictEqual([
      "electronics",
    ]);
  });

  it("returns the full chain to a nested category", () => {
    expect(findCategoryPath(tree, "smartphones").map((n) => n.slug)).toStrictEqual([
      "electronics",
      "phones",
      "smartphones",
    ]);
  });

  it("returns an empty path for an unknown slug", () => {
    expect(findCategoryPath(tree, "nope")).toStrictEqual([]);
  });

  it("does not confuse sibling branches", () => {
    expect(findCategoryPath(tree, "seating").map((n) => n.slug)).toStrictEqual([
      "furniture",
      "seating",
    ]);
  });
});

describe("activeBranchIds", () => {
  it("marks every ancestor of the active category, and nothing else", () => {
    const ids = activeBranchIds(tree, "smartphones");

    expect(ids).toStrictEqual(
      new Set(["id-electronics", "id-phones", "id-smartphones"]),
    );
    expect(ids.has("id-furniture")).toBe(false);
    expect(ids.has("id-seating")).toBe(false);
  });

  it("is empty for an unknown slug, so no branch expands", () => {
    expect(activeBranchIds(tree, "nope").size).toBe(0);
  });
});

describe("buildCategoryBreadcrumbs", () => {
  it("always starts at Home", () => {
    const crumbs = buildCategoryBreadcrumbs([], categoryHref);

    expect(crumbs).toStrictEqual([{ href: "/", label: "Home" }]);
  });

  it("links every ancestor but not the current category", () => {
    const crumbs = buildCategoryBreadcrumbs(
      [
        { name: "Electronics", slug: "electronics" },
        { name: "Phones", slug: "phones" },
        { name: "Smartphones", slug: "smartphones" },
      ],
      categoryHref,
    );

    expect(crumbs).toStrictEqual([
      { href: "/", label: "Home" },
      { href: "/categories/electronics", label: "Electronics" },
      { href: "/categories/phones", label: "Phones" },
      { label: "Smartphones" },
    ]);
  });

  it("leaves a single-level category unlinked as the current page", () => {
    const crumbs = buildCategoryBreadcrumbs(
      [{ name: "Furniture", slug: "furniture" }],
      categoryHref,
    );

    expect(crumbs.at(-1)).toStrictEqual({ label: "Furniture" });
  });
});

describe("resolveCategoryRail", () => {
  it("shows root categories and no parent when nothing is active", () => {
    const rail = resolveCategoryRail(tree, null);

    expect(rail.parent).toBeNull();
    expect(rail.siblings.map((n) => n.slug)).toStrictEqual([
      "electronics",
      "furniture",
    ]);
  });

  it("shows root categories when a root is active, so the active chip is present", () => {
    const rail = resolveCategoryRail(tree, "electronics");

    expect(rail.parent).toBeNull();
    expect(rail.siblings.map((n) => n.slug)).toContain("electronics");
  });

  it("shows the active category's own siblings, not the root's children", () => {
    const rail = resolveCategoryRail(tree, "smartphones");

    expect(rail.parent?.slug).toBe("phones");
    expect(rail.siblings.map((n) => n.slug)).toContain("smartphones");
  });

  it("always includes the active category among the chips it renders", () => {
    for (const slug of [
      "electronics",
      "phones",
      "smartphones",
      "furniture",
      "seating",
    ]) {
      const rail = resolveCategoryRail(tree, slug);

      expect(rail.siblings.map((n) => n.slug)).toContain(slug);
    }
  });

  it("falls back to roots for an unknown slug", () => {
    const rail = resolveCategoryRail(tree, "nope");

    expect(rail.parent).toBeNull();
    expect(rail.siblings).toStrictEqual(tree);
  });
});

describe("topLevelCategories", () => {
  it("flattens roots without their children", () => {
    expect(topLevelCategories(tree).map((c) => c.slug)).toStrictEqual([
      "electronics",
      "furniture",
    ]);
  });
});
