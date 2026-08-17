import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Money } from "@/components/commerce/Money";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { getCachedProductBySlug } from "@/server/cache/catalogue";
import { resolveProductPrice } from "@/server/services/products";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  const description = product.seoDescription ?? product.description;

  return {
    title: product.seoTitle ? { absolute: product.seoTitle } : product.name,
    ...(description ? { description } : {}),
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const primaryImage = product.images[0] ?? null;
  const inStock = product.variants.some((variant) => variant.available > 0);
  const resolved = resolveProductPrice({
    basePrice: product.basePrice,
    comparePrice: product.comparePrice,
  });

  return (
    <div className="mx-auto grid w-full max-w-(--page-max) gap-6 px-(--page-gutter) py-6">
      <Breadcrumb
        items={[
          { href: "/", label: "Home" },
          { label: product.categoryName },
          { label: product.name },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <CloudinaryImage
          alt={primaryImage?.alt ?? product.name}
          displayWidth={720}
          priority
          publicId={primaryImage?.publicId ?? null}
          ratio="square"
          sizes="(min-width: 768px) 45vw, 92vw"
        />

        <div className="grid content-start gap-4">
          <div className="grid gap-1">
            <p className="text-caption text-text-subtle">{product.brandName}</p>
            <h1 className="text-heading-2 font-bold text-text">{product.name}</h1>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <Money className="text-price-lg font-bold" minorUnits={resolved.price} />
            {resolved.comparePrice !== null ? (
              <span className="text-body-sm text-text-subtle line-through">
                <Money minorUnits={resolved.comparePrice} />
              </span>
            ) : null}
            {resolved.discountPercent !== null ? (
              <Badge tone="sale">−{resolved.discountPercent}%</Badge>
            ) : null}
          </div>

          <p className="text-body-sm text-text-muted">
            {inStock ? "In stock" : "Currently out of stock"}
          </p>

          {product.description ? (
            <p className="text-body-sm text-text-muted">{product.description}</p>
          ) : null}

          {product.variants.length > 0 ? (
            <div className="grid gap-2">
              <h2 className="text-label font-semibold text-text">Available options</h2>
              <ul className="grid gap-2">
                {product.variants.map((variant) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    key={variant.id}
                  >
                    <span className="text-body-sm text-text">
                      {Object.values(variant.optionValues).join(" · ") || variant.sku}
                    </span>
                    <span className="flex items-center gap-3">
                      <Money className="text-price" minorUnits={variant.price} />
                      {variant.available > 0 ? null : (
                        <Badge tone="warning">Out of stock</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="rounded-md border border-dashed border-border p-3 text-caption text-text-subtle">
            Gallery, variant selection, specifications and the purchase flow arrive in
            Stage 23.
          </p>
        </div>
      </div>
    </div>
  );
}
