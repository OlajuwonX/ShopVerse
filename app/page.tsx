import { AlertTriangle, PackageX } from "lucide-react";

import { Money } from "@/components/commerce/Money";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { catalogueQuerySchema } from "@/features/products/schemas/catalogue-query";
import {
  getCachedCategoryBySlug,
  getCachedCategoryFilterAttributes,
  getCachedCategoryTree,
  getCachedProductPage,
} from "@/server/cache/catalogue";
import type { CategoryNode } from "@/server/services/categories";
import type { ProductListItem } from "@/server/services/products";

export const revalidate = 60;

const PREVIEW_CATEGORY = "smartphones";

function CategoryBranch({ node }: { node: CategoryNode }) {
  return (
    <li>
      <span className="text-body-sm text-text">{node.name}</span>
      {node.children.length > 0 ? (
        <ul className="mt-1 ml-4 grid gap-1 border-l border-border pl-3">
          {node.children.map((child) => (
            <CategoryBranch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ProductPreviewCard({ product }: { product: ProductListItem }) {
  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="relative">
        <CloudinaryImage
          alt={product.imageAlt ?? product.name}
          displayWidth={320}
          publicId={product.imagePublicId}
          ratio="square"
          sizes="(min-width: 1024px) 18vw, (min-width: 640px) 28vw, 44vw"
        />
        {product.discountPercent !== null ? (
          <Badge className="absolute top-2 left-2" tone="sale">
            −{product.discountPercent}%
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-1">
        <p className="text-caption text-text-subtle">{product.brandName}</p>
        <h3 className="line-clamp-2 text-body-sm font-semibold text-text">
          {product.name}
        </h3>
      </div>

      <div className="mt-auto grid gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Money className="text-price" minorUnits={product.basePrice} />
          {product.comparePrice !== null ? (
            <span className="text-caption text-text-subtle line-through">
              <Money minorUnits={product.comparePrice} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {product.inStock ? null : (
            <Badge tone="warning">
              <PackageX aria-hidden="true" className="mr-1 size-3" />
              Out of stock
            </Badge>
          )}
          {product.requiresSelection ? <Badge>Choose options</Badge> : null}
          {product.rating !== null && product.ratingCount > 0 ? (
            <Badge tone="neutral">
              {(product.rating / 100).toFixed(1)}★ ({product.ratingCount})
            </Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

async function loadPreview() {
  const [tree, page, category] = await Promise.all([
    getCachedCategoryTree(),
    getCachedProductPage(catalogueQuerySchema.parse({ limit: 24, sort: "popularity" })),
    getCachedCategoryBySlug(PREVIEW_CATEGORY),
  ]);

  const filters = category ? await getCachedCategoryFilterAttributes(category.id) : [];

  return { category, filters, page, tree };
}

export default async function CataloguePreviewPage() {
  let data: Awaited<ReturnType<typeof loadPreview>>;

  try {
    data = await loadPreview();
  } catch {
    return (
      <main className="mx-auto grid w-full max-w-(--page-max) gap-6 px-(--page-gutter) py-10">
        <ErrorState
          description="The catalogue could not be loaded. Check DATABASE_URL, then run `pnpm db:migrate` and `pnpm db:seed`."
          title="No catalogue data"
        />
      </main>
    );
  }

  const { category, filters, page, tree } = data;

  return (
    <main className="mx-auto grid w-full max-w-(--page-max) gap-8 px-(--page-gutter) py-8">
      <div className="flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-warning"
        />
        <div className="grid gap-1">
          <p className="text-label font-semibold text-text">
            Development catalogue preview
          </p>
          <p className="text-body-sm text-text-muted">
            Rendered live from Neon through the Stage 14 services. This is not the
            storefront — navigation arrives at Stage 16 and the real homepage at Stage
            17, which replaces this page.
          </p>
        </div>
      </div>

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Stage 14"
          title={`Category tree · ${tree.length} top-level`}
        />
        <Card className="p-4">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tree.map((node) => (
              <CategoryBranch key={node.id} node={node} />
            ))}
          </ul>
        </Card>
      </section>

      {category ? (
        <section className="grid gap-4">
          <SectionHeader
            eyebrow="Stage 14"
            title={`Filters resolved for ${category.name}`}
          />
          <Card className="grid gap-3 p-4">
            <p className="text-body-sm text-text-muted">
              Generated from category configuration, including attributes inherited from
              ancestors — <code className="text-caption">Colour</code> is attached to
              Electronics, not to Smartphones.
            </p>
            <ul className="grid gap-2">
              {filters.map((attribute) => (
                <li key={attribute.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-label font-semibold text-text">
                    {attribute.name}
                  </span>
                  <span className="text-caption text-text-subtle">
                    {attribute.type}
                    {attribute.unit ? ` · ${attribute.unit}` : ""}
                  </span>
                  {attribute.options.map((option) => (
                    <Badge key={option.id} tone="neutral">
                      {option.value}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4">
        <SectionHeader
          eyebrow="Stage 14"
          title={`Products · ${page.items.length} shown, sorted by popularity`}
        />

        {page.items.length === 0 ? (
          <EmptyState
            description="Run `pnpm db:seed` to populate the catalogue."
            title="No products yet"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {page.items.map((product) => (
              <li key={product.id}>
                <ProductPreviewCard product={product} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-caption text-text-subtle">
          Images show the Stage 13 placeholder at the correct aspect ratio — no
          Cloudinary assets have been uploaded yet, so no layout shift occurs when they
          are.
          {page.nextCursor
            ? " More products are available through the next cursor; infinite scrolling arrives at Stage 22."
            : null}
        </p>
      </section>
    </main>
  );
}
