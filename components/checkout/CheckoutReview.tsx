"use client";

import Link from "next/link";

import { Money } from "@/components/commerce/Money";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import type { CartLineView } from "@/features/cart/useCartValidation";
import { cartHref, productHref } from "@/lib/routes";

function optionSummary(optionValues: Record<string, string>) {
  const values = Object.values(optionValues);

  return values.length > 0 ? values.join(" · ") : null;
}

export function CheckoutReview({ lines }: { lines: readonly CartLineView[] }) {
  return (
    <section aria-labelledby="review-heading" className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-heading-3 font-bold text-text" id="review-heading">
          Review items
        </h2>
        <Link
          className="rounded-md text-body-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          href={cartHref()}
        >
          Edit cart
        </Link>
      </div>

      <ul className="grid rounded-lg border border-border bg-surface-raised px-4">
        {lines.map((line) => {
          const name = line.snapshot?.productName ?? "This product";
          const options = line.snapshot
            ? optionSummary(line.snapshot.optionValues)
            : null;

          return (
            <li
              className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              key={line.key}
            >
              <div className="w-14 shrink-0">
                <CloudinaryImage
                  alt={line.snapshot?.imageAlt ?? name}
                  displayWidth={112}
                  publicId={line.snapshot?.imagePublicId ?? null}
                  ratio="square"
                  sizes="56px"
                />
              </div>

              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-body-sm font-semibold text-text">
                  {line.snapshot ? (
                    <Link
                      className="rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      href={productHref(line.snapshot.productSlug)}
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <p className="text-caption text-text-muted">
                  {options ? `${options} · ` : ""}Quantity {line.quantity}
                </p>
              </div>

              <Money
                className="shrink-0 text-body-sm font-semibold"
                minorUnits={line.lineTotal}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
