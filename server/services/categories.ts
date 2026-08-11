import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  attributeOptions,
  attributes,
  categories,
  categoryAttributes,
} from "@/server/db/schema";

export type CategoryNode = {
  children: CategoryNode[];
  depth: number;
  description: string | null;
  icon: string | null;
  id: string;
  name: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
};

export type CategorySummary = Omit<CategoryNode, "children" | "depth">;

/**
 * Maximum supported nesting. Primitive 12 sets three levels as the working
 * assumption; anything deeper is an architecture decision, not a data accident,
 * so the recursive walk is bounded rather than trusting the data to terminate.
 */
export const MAX_CATEGORY_DEPTH = 3;

const activeCategoryColumns = {
  description: categories.description,
  icon: categories.icon,
  id: categories.id,
  name: categories.name,
  parentId: categories.parentId,
  slug: categories.slug,
  sortOrder: categories.sortOrder,
};

async function selectActiveCategories() {
  return db
    .select(activeCategoryColumns)
    .from(categories)
    .where(eq(categories.status, "active"))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/**
 * Builds the active category tree in one query.
 *
 * The whole active set is small and read on nearly every storefront page, so it
 * is fetched once and assembled in memory rather than issuing a query per level
 * (MASTER §61 — avoid N+1).
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const rows = await selectActiveCategories();

  const nodes = new Map<string, CategoryNode>();

  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [], depth: 0 });
  }

  const roots: CategoryNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      // A child whose parent is inactive is surfaced at the root rather than
      // silently disappearing from navigation.
      roots.push(node);
    }
  }

  const assignDepth = (node: CategoryNode, depth: number) => {
    node.depth = depth;

    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  };

  for (const root of roots) {
    assignDepth(root, 0);
  }

  return roots;
}

export async function getCategoryBySlug(slug: string) {
  const rows = await db
    .select(activeCategoryColumns)
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.status, "active")))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The documented inclusion rule (primitives/12): a category page shows its own
 * products **plus its descendants'**. Every caller uses this function rather
 * than reimplementing the walk per page.
 *
 * Expressed as a recursive CTE so the depth walk happens in one round trip, with
 * a depth bound that makes a malformed cycle terminate rather than hang
 * (defence in depth alongside DATA-04's write-time validation).
 */
export async function getCategoryAndDescendantIds(categoryId: string) {
  const result = await db.execute<{ id: string }>(sql`
    with recursive branch as (
      select c.id, 0 as depth
      from ${categories} c
      where c.id = ${categoryId} and c.status = 'active'
      union all
      select child.id, branch.depth + 1
      from ${categories} child
      join branch on child.parent_id = branch.id
      where child.status = 'active' and branch.depth < ${MAX_CATEGORY_DEPTH}
    )
    select distinct id from branch
  `);

  return result.rows.map((row) => row.id);
}

/**
 * Ancestor chain, root first — the source for breadcrumbs (MASTER §19).
 */
export async function getCategoryAncestors(categoryId: string) {
  const result = await db.execute<{
    depth: number;
    name: string;
    slug: string;
  }>(sql`
    with recursive chain as (
      select c.id, c.parent_id, c.name, c.slug, 0 as depth
      from ${categories} c
      where c.id = ${categoryId}
      union all
      select parent.id, parent.parent_id, parent.name, parent.slug, chain.depth + 1
      from ${categories} parent
      join chain on chain.parent_id = parent.id
      where chain.depth < ${MAX_CATEGORY_DEPTH}
    )
    select name, slug, depth from chain order by depth desc
  `);

  return result.rows.map((row) => ({ name: row.name, slug: row.slug }));
}

export type ResolvedAttribute = {
  id: string;
  isFilterable: boolean;
  isVariantOption: boolean;
  name: string;
  options: { id: string; value: string }[];
  slug: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect" | "range";
  unit: string | null;
};

/**
 * Resolves the filterable attributes for a category, including those inherited
 * from its ancestors (primitives/12).
 *
 * This is the single resolution function the filter panel is generated from —
 * no page hand-writes a filter list. A nearer category wins on conflict, so a
 * child can override an inherited definition.
 */
export async function getCategoryFilterAttributes(
  categoryId: string,
): Promise<ResolvedAttribute[]> {
  const chain = await db.execute<{ depth: number; id: string }>(sql`
    with recursive chain as (
      select c.id, c.parent_id, 0 as depth
      from ${categories} c
      where c.id = ${categoryId}
      union all
      select parent.id, parent.parent_id, chain.depth + 1
      from ${categories} parent
      join chain on chain.parent_id = parent.id
      where chain.depth < ${MAX_CATEGORY_DEPTH}
    )
    select id, depth from chain
  `);

  if (chain.rows.length === 0) {
    return [];
  }

  const depthByCategory = new Map(chain.rows.map((row) => [row.id, row.depth]));
  const categoryIds = [...depthByCategory.keys()];

  const rows = await db
    .select({
      attributeId: attributes.id,
      categoryId: categoryAttributes.categoryId,
      isFilterable: attributes.isFilterable,
      isVariantOption: attributes.isVariantOption,
      name: attributes.name,
      slug: attributes.slug,
      sortOrder: categoryAttributes.sortOrder,
      type: attributes.type,
      unit: attributes.unit,
    })
    .from(categoryAttributes)
    .innerJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
    .where(
      and(
        inArray(categoryAttributes.categoryId, categoryIds),
        eq(attributes.isFilterable, true),
      ),
    )
    .orderBy(asc(categoryAttributes.sortOrder), asc(attributes.name));

  // Nearest ancestor wins: depth 0 is the category itself.
  const nearest = new Map<string, (typeof rows)[number]>();

  for (const row of rows) {
    const existing = nearest.get(row.attributeId);
    const rowDepth = depthByCategory.get(row.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const existingDepth = existing
      ? (depthByCategory.get(existing.categoryId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;

    if (!existing || rowDepth < existingDepth) {
      nearest.set(row.attributeId, row);
    }
  }

  const resolved = [...nearest.values()];

  if (resolved.length === 0) {
    return [];
  }

  const options = await db
    .select({
      attributeId: attributeOptions.attributeId,
      id: attributeOptions.id,
      value: attributeOptions.value,
    })
    .from(attributeOptions)
    .where(
      inArray(
        attributeOptions.attributeId,
        resolved.map((attribute) => attribute.attributeId),
      ),
    )
    .orderBy(asc(attributeOptions.sortOrder), asc(attributeOptions.value));

  const optionsByAttribute = new Map<string, { id: string; value: string }[]>();

  for (const option of options) {
    const bucket = optionsByAttribute.get(option.attributeId) ?? [];
    bucket.push({ id: option.id, value: option.value });
    optionsByAttribute.set(option.attributeId, bucket);
  }

  return resolved.map((attribute) => ({
    id: attribute.attributeId,
    isFilterable: attribute.isFilterable,
    isVariantOption: attribute.isVariantOption,
    name: attribute.name,
    options: optionsByAttribute.get(attribute.attributeId) ?? [],
    slug: attribute.slug,
    type: attribute.type,
    unit: attribute.unit,
  }));
}

/**
 * Cycle detection for category writes (DATA-04). A category may not be its own
 * ancestor; the database check constraint only catches the self-parent case.
 */
export async function wouldCreateCategoryCycle(input: {
  categoryId: string;
  parentId: string | null;
}) {
  if (!input.parentId) {
    return false;
  }

  if (input.parentId === input.categoryId) {
    return true;
  }

  const result = await db.execute<{ id: string }>(sql`
    with recursive chain as (
      select c.id, c.parent_id, 0 as depth
      from ${categories} c
      where c.id = ${input.parentId}
      union all
      select parent.id, parent.parent_id, chain.depth + 1
      from ${categories} parent
      join chain on chain.parent_id = parent.id
      where chain.depth < ${MAX_CATEGORY_DEPTH + 1}
    )
    select id from chain where id = ${input.categoryId} limit 1
  `);

  return result.rows.length > 0;
}
