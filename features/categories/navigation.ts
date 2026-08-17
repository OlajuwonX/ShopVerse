import type { CategoryNode } from "@/server/services/categories";

export type CategoryBreadcrumb = {
  href?: string;
  label: string;
};

export function buildCategoryBreadcrumbs(
  ancestors: readonly { name: string; slug: string }[],
  categoryHref: (slug: string) => string,
): CategoryBreadcrumb[] {
  return [
    { href: "/", label: "Home" },
    ...ancestors.map((ancestor, index) => {
      const isCurrent = index === ancestors.length - 1;

      return isCurrent
        ? { label: ancestor.name }
        : { href: categoryHref(ancestor.slug), label: ancestor.name };
    }),
  ];
}

export function findCategoryPath(
  nodes: readonly CategoryNode[],
  slug: string,
): CategoryNode[] {
  for (const node of nodes) {
    if (node.slug === slug) {
      return [node];
    }

    const childPath = findCategoryPath(node.children, slug);

    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
}

export function activeBranchIds(nodes: readonly CategoryNode[], slug: string) {
  return new Set(findCategoryPath(nodes, slug).map((node) => node.id));
}

export function resolveCategoryRail(
  nodes: readonly CategoryNode[],
  activeSlug: string | null,
): { parent: CategoryNode | null; siblings: readonly CategoryNode[] } {
  const path = activeSlug ? findCategoryPath(nodes, activeSlug) : [];
  const parent = path.length > 1 ? (path.at(-2) ?? null) : null;

  return { parent, siblings: parent ? parent.children : nodes };
}

export function topLevelCategories(nodes: readonly CategoryNode[]) {
  return nodes.map((node) => ({ id: node.id, name: node.name, slug: node.slug }));
}
