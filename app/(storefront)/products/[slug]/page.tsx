import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/commerce/ProductGallery";
import { ProductPurchase } from "@/components/commerce/ProductPurchase";
import { SaveProductButton } from "@/components/commerce/SaveProductButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { serverEnv } from "@/config/env";
import { buildCategoryBreadcrumbs } from "@/features/categories/navigation";
import { buildCloudinaryUrl } from "@/lib/media/cloudinary-url";
import { toMajorUnits } from "@/lib/money";
import { categoryHref, productHref } from "@/lib/routes";
import {
  getCachedCategoryAncestors,
  getCachedProductAttributes,
  getCachedProductBySlug,
} from "@/server/cache/catalogue";
import type { ProductDetail } from "@/server/services/products";

export const revalidate = 60;

function primaryImage(product: ProductDetail) {
  return product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  const description = product.seoDescription ?? product.description;
  const image = primaryImage(product);
  const imageUrl = image
    ? buildCloudinaryUrl(image.publicId, { ratio: "square", width: 1200 })
    : null;

  return {
    alternates: { canonical: productHref(product.slug) },
    ...(description ? { description } : {}),
    openGraph: {
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      title: product.seoTitle ?? product.name,
      type: "website",
      url: productHref(product.slug),
    },
    title: product.seoTitle ? { absolute: product.seoTitle } : product.name,
  };
}

function buildProductJsonLd(product: ProductDetail, origin: string) {
  const image = primaryImage(product);
  const imageUrl = image
    ? buildCloudinaryUrl(image.publicId, { ratio: "square", width: 1200 })
    : null;

  const inStock = product.variants.some((variant) => variant.available > 0);
  const prices = product.variants.map((variant) => variant.price);
  const lowPrice = prices.length > 0 ? Math.min(...prices) : product.basePrice;
  const highPrice = prices.length > 0 ? Math.max(...prices) : product.basePrice;
  const url = new URL(productHref(product.slug), origin).toString();

  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    brand: { "@type": "Brand", name: product.brandName },
    ...(product.description ? { description: product.description } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    name: product.name,
    offers:
      lowPrice === highPrice
        ? {
            "@type": "Offer",
            availability,
            price: toMajorUnits(lowPrice),
            priceCurrency: "NGN",
            url,
          }
        : {
            "@type": "AggregateOffer",
            availability,
            highPrice: toMajorUnits(highPrice),
            lowPrice: toMajorUnits(lowPrice),
            offerCount: product.variants.length,
            priceCurrency: "NGN",
            url,
          },
    ...(product.variants[0] ? { sku: product.variants[0].sku } : {}),
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [ancestors, specifications] = await Promise.all([
    getCachedCategoryAncestors(product.categoryId),
    getCachedProductAttributes(product.id),
  ]);

  const breadcrumbs = [
    ...buildCategoryBreadcrumbs(ancestors, categoryHref).map((crumb, index, all) =>
      index === all.length - 1 && crumb.href === undefined
        ? { href: categoryHref(product.categorySlug), label: crumb.label }
        : crumb,
    ),
    { label: product.name },
  ];

  return (
    <div className="grid gap-8 py-6">
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs, serverEnv.APP_ORIGIN)} />
      <JsonLd data={buildProductJsonLd(product, serverEnv.APP_ORIGIN)} />

      <Breadcrumb items={breadcrumbs} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="grid content-start gap-5">
          <div className="grid gap-1">
            <p className="text-caption text-text-subtle">{product.brandName}</p>
            <h1 className="text-heading-2 font-bold text-text">{product.name}</h1>
            {product.rating !== null && product.ratingCount > 0 ? (
              <p className="text-body-sm text-text-muted">
                {(product.rating / 100).toFixed(1)} out of 5 from {product.ratingCount}{" "}
                reviews
              </p>
            ) : null}
          </div>

          <ProductPurchase
            basePrice={product.basePrice}
            comparePrice={product.comparePrice}
            productName={product.name}
            variants={product.variants}
          />

          <SaveProductButton
            className="justify-self-start"
            productId={product.id}
            productName={product.name}
          />

          <p className="text-body-sm text-text-muted">
            Delivered nationwide. Delivery cost is calculated at checkout.
          </p>
        </div>
      </div>

      {product.description ? (
        <section className="grid gap-2">
          <h2 className="text-heading-3 font-bold text-text">Details</h2>
          <p className="max-w-2xl text-body-sm text-text-muted">
            {product.description}
          </p>
        </section>
      ) : null}

      {specifications.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-heading-3 font-bold text-text">Specifications</h2>
          <dl className="grid max-w-2xl gap-0 overflow-hidden rounded-lg border border-border">
            {specifications.map((specification, index) => (
              <div
                className={
                  index % 2 === 0
                    ? "grid grid-cols-[10rem_1fr] gap-3 bg-surface-raised px-4 py-3"
                    : "grid grid-cols-[10rem_1fr] gap-3 px-4 py-3"
                }
                key={specification.slug}
              >
                <dt className="text-body-sm font-semibold text-text">
                  {specification.name}
                </dt>
                <dd className="text-body-sm text-text-muted">
                  {specification.value}
                  {specification.unit ? ` ${specification.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div aria-hidden="true" className="h-20 lg:hidden" />
    </div>
  );
}
