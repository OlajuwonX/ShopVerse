import Link from "next/link";

import { ProductCard } from "@/components/commerce/ProductCard";
import { ProductRail } from "@/components/commerce/ProductRail";
import { SectionShell } from "@/components/storefront/SectionShell";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/cn";
import type { ResolvedSection } from "@/server/cache/storefront";
import type { ProductListItem } from "@/server/services/products";

const gridColumnClasses: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

function ProductGrid({
  columns,
  isAboveFold,
  products,
}: {
  columns: number;
  isAboveFold: boolean;
  products: ProductListItem[];
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3",
        gridColumnClasses[columns] ?? "lg:grid-cols-4",
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard priority={isAboveFold && index < 4} product={product} />
        </li>
      ))}
    </ul>
  );
}

export function SectionRenderer({
  isAboveFold = false,
  resolved,
}: {
  isAboveFold?: boolean;
  resolved: ResolvedSection;
}) {
  const { payload, section } = resolved;

  if (payload.kind === "empty") {
    return null;
  }

  if (payload.kind === "error") {
    return (
      <SectionShell title={section.title}>
        <ErrorState
          description="This section could not be loaded. The rest of the page is unaffected."
          title="Section unavailable"
        />
      </SectionShell>
    );
  }

  if (payload.kind === "campaign") {
    const { campaign } = payload;
    const isSplit = campaign.type === "split_campaign";

    return (
      <section className="grid gap-4">
        <div
          className={cn(
            "grid items-center gap-4 rounded-lg border border-border bg-surface-raised p-5",
            isSplit ? "md:grid-cols-2" : "md:grid-cols-[1.2fr_1fr]",
          )}
        >
          <div className="grid gap-2">
            {campaign.content.eyebrow ? (
              <p className="text-caption font-bold text-brand uppercase">
                {campaign.content.eyebrow}
              </p>
            ) : null}
            <h2 className="text-heading-3 font-bold text-text">{campaign.title}</h2>
            {campaign.content.body ? (
              <p className="text-body-sm text-text-muted">{campaign.content.body}</p>
            ) : null}
            {campaign.href && campaign.content.ctaLabel ? (
              <Link
                className="mt-1 inline-flex min-h-11 w-fit items-center rounded-md bg-brand px-4 text-label font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={campaign.href}
              >
                {campaign.content.ctaLabel}
              </Link>
            ) : null}
          </div>

          {isSplit ? (
            <div className="grid gap-2 border-border md:border-l md:pl-5">
              {campaign.content.secondaryBody ? (
                <p className="text-body-sm text-text-muted">
                  {campaign.content.secondaryBody}
                </p>
              ) : null}
              {campaign.content.secondaryCtaHref &&
              campaign.content.secondaryCtaLabel ? (
                <Link
                  className="inline-flex min-h-11 w-fit items-center rounded-md border border-border px-4 text-label font-semibold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  href={campaign.content.secondaryCtaHref}
                >
                  {campaign.content.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          ) : (
            <CloudinaryImage
              alt=""
              className="w-full"
              displayWidth={640}
              priority={isAboveFold}
              publicId={campaign.image}
              ratio="wide"
              sizes="(min-width: 768px) 40vw, 90vw"
            />
          )}
        </div>
      </section>
    );
  }

  if (payload.kind === "categories") {
    return (
      <SectionShell title={section.title} viewMoreHref={section.viewMoreHref}>
        <ul className="-mx-(--page-gutter) flex snap-x gap-2 overflow-x-auto px-(--page-gutter) pb-2">
          {payload.items.map((category) => (
            <li className="snap-start" key={category.id}>
              <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface-raised px-4 text-body-sm font-semibold whitespace-nowrap text-text">
                {category.name}
              </span>
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  if (payload.kind === "brands") {
    return (
      <SectionShell title={section.title} viewMoreHref={section.viewMoreHref}>
        <ul className="-mx-(--page-gutter) flex snap-x gap-2 overflow-x-auto px-(--page-gutter) pb-2">
          {payload.items.map((brand) => (
            <li className="snap-start" key={brand.slug}>
              <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface-raised px-4 text-body-sm font-semibold whitespace-nowrap text-text">
                {brand.name}
              </span>
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  const columns = section.desktopConfig.columns ?? 4;

  return (
    <SectionShell title={section.title} viewMoreHref={section.viewMoreHref}>
      {section.type === "product_grid" ? (
        <ProductGrid
          columns={columns}
          isAboveFold={isAboveFold}
          products={payload.items}
        />
      ) : (
        <ProductRail
          isAboveFold={isAboveFold}
          label={section.title}
          products={payload.items}
        />
      )}
    </SectionShell>
  );
}
