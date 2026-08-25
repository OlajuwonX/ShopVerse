"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/commerce/Money";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { CART_MAX_LINE_QUANTITY } from "@/constants/cart";
import type { CartLineView } from "@/features/cart/useCartValidation";
import { productHref } from "@/lib/routes";

type CartLineProps = {
  line: CartLineView;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  storedQuantity: number;
};

function optionSummary(optionValues: Record<string, string>) {
  const values = Object.values(optionValues);

  return values.length > 0 ? values.join(" · ") : null;
}

function LineNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "danger";
}) {
  return (
    <p
      className={
        tone === "danger"
          ? "rounded-md bg-danger-soft px-3 py-2 text-caption font-medium text-danger"
          : "rounded-md bg-warning-soft px-3 py-2 text-caption font-medium text-warning"
      }
    >
      {children}
    </p>
  );
}

export function CartLine({
  line,
  onQuantityChange,
  onRemove,
  storedQuantity,
}: CartLineProps) {
  const { snapshot } = line;
  const name = snapshot?.productName ?? "This product";
  const options = snapshot ? optionSummary(snapshot.optionValues) : null;

  const quantityReduced = line.issues.find(
    (issue) => issue.code === "QUANTITY_REDUCED",
  );
  const outOfStock = line.issues.some((issue) => issue.code === "OUT_OF_STOCK");
  const variantUnavailable = line.issues.some(
    (issue) => issue.code === "VARIANT_UNAVAILABLE",
  );
  const productUnavailable = line.issues.some(
    (issue) => issue.code === "PRODUCT_UNAVAILABLE",
  );

  const displayQuantity = storedQuantity;
  const canIncrease =
    line.purchasable &&
    displayQuantity < Math.min(line.availableQuantity, CART_MAX_LINE_QUANTITY);

  return (
    <li className="grid gap-3 border-b border-border py-4 last:border-b-0">
      <div className="flex gap-3">
        <div className="w-20 shrink-0 sm:w-24">
          <CloudinaryImage
            alt={snapshot?.imageAlt ?? name}
            displayWidth={160}
            publicId={snapshot?.imagePublicId ?? null}
            ratio="square"
            sizes="96px"
          />
        </div>

        <div className="grid min-w-0 flex-1 content-start gap-1">
          {snapshot ? (
            <p className="text-caption text-text-subtle">{snapshot.brandName}</p>
          ) : null}

          <h3 className="text-body-sm font-semibold text-text">
            {snapshot ? (
              <Link
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:underline"
                href={productHref(snapshot.productSlug)}
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>

          {options ? <p className="text-caption text-text-muted">{options}</p> : null}

          {line.snapshot ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <Money
                className="text-body-sm font-semibold"
                minorUnits={line.unitPrice}
              />
              {line.comparePrice !== null && line.comparePrice > line.unitPrice ? (
                <span className="text-caption text-text-subtle line-through">
                  <Money minorUnits={line.comparePrice} />
                </span>
              ) : null}
              <span className="text-caption text-text-subtle">each</span>
            </div>
          ) : null}
        </div>

        <div className="grid content-start justify-items-end gap-2">
          {line.purchasable ? (
            <Money className="text-body-sm font-semibold" minorUnits={line.lineTotal} />
          ) : null}

          <button
            aria-label={`Remove ${name} from cart`}
            className="inline-flex size-11 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => {
              onRemove(line.key);
            }}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {productUnavailable ? (
        <LineNotice tone="danger">
          This product is no longer available and will not be ordered. Remove it to
          continue.
        </LineNotice>
      ) : null}

      {variantUnavailable ? (
        <LineNotice tone="danger">
          {outOfStock
            ? `${name} is no longer available in any option.`
            : `This option of ${name} is no longer sold. Choose another option to continue.`}
        </LineNotice>
      ) : null}

      {outOfStock && !variantUnavailable ? (
        <LineNotice tone="danger">
          {name} is out of stock. Remove it to check out.
        </LineNotice>
      ) : null}

      {quantityReduced ? (
        <LineNotice tone="warning">
          Only {quantityReduced.resolvedQuantity} left in stock, so the quantity was
          reduced from {quantityReduced.requestedQuantity}.
        </LineNotice>
      ) : null}

      {line.priceChanged ? (
        <LineNotice tone="warning">
          The price changed from <Money minorUnits={line.lastSeenUnitPrice ?? 0} /> to{" "}
          <Money minorUnits={line.unitPrice} />. Review the new price before checking
          out.
        </LineNotice>
      ) : null}

      {line.purchasable ? (
        <div className="flex items-center gap-2">
          <span className="text-caption text-text-subtle" id={`${line.key}-quantity`}>
            Quantity
          </span>

          <div className="inline-flex items-center rounded-md border border-border">
            <button
              aria-label={`Decrease quantity of ${name}`}
              className="inline-flex size-11 items-center justify-center rounded-l-md text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-text-subtle"
              onClick={() => {
                onQuantityChange(line.key, displayQuantity - 1);
              }}
              type="button"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>

            <output
              aria-labelledby={`${line.key}-quantity`}
              className="min-w-10 px-2 text-center text-body-sm font-semibold text-text"
            >
              {displayQuantity}
            </output>

            <button
              aria-label={`Increase quantity of ${name}`}
              className="inline-flex size-11 items-center justify-center rounded-r-md text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-text-subtle"
              disabled={!canIncrease}
              onClick={() => {
                onQuantityChange(line.key, displayQuantity + 1);
              }}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>

          {line.availableQuantity <= 5 ? (
            <span className="text-caption text-warning">
              {line.availableQuantity} left
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
