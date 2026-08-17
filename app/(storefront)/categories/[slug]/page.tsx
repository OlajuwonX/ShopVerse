import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/commerce/ProductGrid";
import { CategoryRail } from "@/components/navigation/CategoryRail";
import { CategorySidebar } from "@/components/navigation/CategorySidebar";
import { buildBreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { serverEnv } from "@/config/env";
import { catalogueQuerySchema } from "@/features/products/schemas/catalogue-query";
import { buildCategoryBreadcrumbs } from "@/features/categories/navigation";
import { categoryHref } from "@/lib/routes";
import {
  getCachedCategoryAncestors,
  getCachedCategoryBySlug,
  getCachedCategoryTree,
  getCachedProductPage,
} from "@/server/cache/catalogue";

export const revalidate = 60;

const CATEGORY_PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    alternates: { canonical: categoryHref(category.slug) },
    ...(category.description ? { description: category.description } : {}),
    openGraph: {
      title: `${category.name} | ShopVerse`,
      type: "website",
      url: categoryHref(category.slug),
      ...(category.description ? { description: category.description } : {}),
    },
    title: category.name,
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [ancestors, tree, page] = await Promise.all([
    getCachedCategoryAncestors(category.id),
    getCachedCategoryTree(),
    getCachedProductPage(
      catalogueQuerySchema.parse({
        categorySlug: category.slug,
        limit: CATEGORY_PAGE_SIZE,
        sort: "popularity",
      }),
    ),
  ]);

  const breadcrumbs = buildCategoryBreadcrumbs(ancestors, categoryHref);

  return (
    <div className="mx-auto w-full max-w-(--page-max) px-(--page-gutter) py-6">
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs, serverEnv.APP_ORIGIN)} />

      <Breadcrumb className="mb-4" items={breadcrumbs} />

      <CategoryRail activeSlug={category.slug} className="mb-6 lg:hidden" tree={tree} />

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-32">
            <CategorySidebar activeSlug={category.slug} tree={tree} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-4 grid gap-1">
            <h1 className="text-heading-2 font-bold text-text">{category.name}</h1>
            {category.description ? (
              <p className="text-body-sm text-text-muted">{category.description}</p>
            ) : null}
          </header>

          {page.items.length === 0 ? (
            <EmptyState
              description="Nothing is listed in this category yet. Browse the rest of the store while it fills up."
              title="No products here yet"
            />
          ) : (
            <ProductGrid
              isAboveFold
              label={`${category.name} products`}
              products={page.items}
            />
          )}

          {page.nextCursor ? (
            <p className="mt-6 text-caption text-text-subtle">
              More products are available in this category; continuous browsing arrives
              in Stage 22.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
