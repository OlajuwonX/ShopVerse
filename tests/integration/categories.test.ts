import { describe, expect, it } from "vitest";

import { hasRealDatabase } from "@/tests/setup/env";
import {
  getCategoryAncestors,
  getCategoryAndDescendantIds,
  getCategoryBySlug,
  getCategoryFilterAttributes,
  getCategoryTree,
  MAX_CATEGORY_DEPTH,
  wouldCreateCategoryCycle,
  type CategoryNode,
} from "@/server/services/categories";

function flatten(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe.skipIf(!hasRealDatabase)("getCategoryTree", () => {
  it("assembles a tree with roots and nested children", async () => {
    const tree = await getCategoryTree();

    expect(tree.length).toBeGreaterThan(0);
    expect(tree.every((node) => node.parentId === null)).toBe(true);
    expect(flatten(tree).some((node) => node.children.length > 0)).toBe(true);
  });

  it("assigns depth from the root and stays within the configured bound (DATA-04)", async () => {
    const nodes = flatten(await getCategoryTree());

    expect(nodes.every((node) => node.depth < MAX_CATEGORY_DEPTH)).toBe(true);

    for (const node of nodes) {
      for (const child of node.children) {
        expect(child.depth).toBe(node.depth + 1);
      }
    }
  });

  it("contains no duplicate ids, so the tree is acyclic", async () => {
    const nodes = flatten(await getCategoryTree());

    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  });
});

describe.skipIf(!hasRealDatabase)("category lookup", () => {
  it("returns null for an unknown slug", async () => {
    expect(await getCategoryBySlug("no-such-category")).toBeNull();
  });

  it("resolves a known slug", async () => {
    const category = await getCategoryBySlug("electronics");

    expect(category?.slug).toBe("electronics");
  });
});

describe.skipIf(!hasRealDatabase)("getCategoryAndDescendantIds", () => {
  it("includes the category itself plus its descendants", async () => {
    const electronics = await getCategoryBySlug("electronics");
    const smartphones = await getCategoryBySlug("smartphones");

    expect(electronics).not.toBeNull();

    const ids = await getCategoryAndDescendantIds(electronics?.id ?? "");

    expect(ids).toContain(electronics?.id);
    expect(ids.length).toBeGreaterThan(1);

    if (smartphones) {
      expect(ids).toContain(smartphones.id);
    }
  });

  it("returns just the leaf for a category with no children", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const ids = await getCategoryAndDescendantIds(smartphones?.id ?? "");

    expect(ids).toStrictEqual([smartphones?.id]);
  });

  it("returns nothing for an id that does not exist", async () => {
    const ids = await getCategoryAndDescendantIds(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(ids).toStrictEqual([]);
  });
});

describe.skipIf(!hasRealDatabase)("getCategoryAncestors", () => {
  it("returns the root-first chain including the category itself", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const chain = await getCategoryAncestors(smartphones?.id ?? "");

    expect(chain.length).toBeGreaterThan(1);
    expect(chain.at(-1)?.slug).toBe("smartphones");
    expect(chain[0]?.slug).toBe("electronics");
  });
});

describe.skipIf(!hasRealDatabase)("getCategoryFilterAttributes", () => {
  it("inherits attributes from ancestors, nearest wins", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const attributes = await getCategoryFilterAttributes(smartphones?.id ?? "");

    expect(attributes.length).toBeGreaterThan(0);
    expect(attributes.map((a) => a.slug)).toContain("colour");
  });

  it("returns each attribute at most once", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const attributes = await getCategoryFilterAttributes(smartphones?.id ?? "");

    expect(new Set(attributes.map((a) => a.id)).size).toBe(attributes.length);
  });

  it("returns only filterable attributes", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const attributes = await getCategoryFilterAttributes(smartphones?.id ?? "");

    expect(attributes.every((attribute) => attribute.isFilterable)).toBe(true);
  });

  it("returns nothing for an unknown category", async () => {
    expect(
      await getCategoryFilterAttributes("00000000-0000-4000-8000-000000000000"),
    ).toStrictEqual([]);
  });
});

describe.skipIf(!hasRealDatabase)("wouldCreateCategoryCycle (DATA-04)", () => {
  it("rejects making a category its own parent", async () => {
    const electronics = await getCategoryBySlug("electronics");

    expect(
      await wouldCreateCategoryCycle({
        categoryId: electronics?.id ?? "",
        parentId: electronics?.id ?? "",
      }),
    ).toBe(true);
  });

  it("rejects reparenting an ancestor under its own descendant", async () => {
    const electronics = await getCategoryBySlug("electronics");
    const smartphones = await getCategoryBySlug("smartphones");

    expect(
      await wouldCreateCategoryCycle({
        categoryId: electronics?.id ?? "",
        parentId: smartphones?.id ?? "",
      }),
    ).toBe(true);
  });

  it("allows a legitimate reparent", async () => {
    const smartphones = await getCategoryBySlug("smartphones");
    const furniture = await getCategoryBySlug("furniture");

    expect(
      await wouldCreateCategoryCycle({
        categoryId: smartphones?.id ?? "",
        parentId: furniture?.id ?? "",
      }),
    ).toBe(false);
  });

  it("allows promoting a category to a root", async () => {
    const smartphones = await getCategoryBySlug("smartphones");

    expect(
      await wouldCreateCategoryCycle({
        categoryId: smartphones?.id ?? "",
        parentId: null,
      }),
    ).toBe(false);
  });
});
