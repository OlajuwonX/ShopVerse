import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { CART_MAX_LINE_QUANTITY, CART_MAX_LINES } from "@/constants/cart";
import type { CartIssueCode } from "@/constants/cart";
import type { CartLineInput } from "@/features/cart/schemas/cart";
import { cartLineKey } from "@/features/cart/schemas/cart";
import { db } from "@/server/db";
import {
  brands,
  inventory,
  productImages,
  productVariants,
  products,
} from "@/server/db/schema";
import { quoteDelivery } from "@/server/services/delivery";
import { resolveProductPrice } from "@/server/services/products";

export type CartIssue = {
  code: CartIssueCode;
  requestedQuantity?: number;
  resolvedQuantity?: number;
};

export type CartLineSnapshot = {
  brandName: string;
  imageAlt: string | null;
  imagePublicId: string | null;
  optionValues: Record<string, string>;
  productName: string;
  productSlug: string;
  sku: string;
};

export type ValidatedCartLine = {
  availableQuantity: number;
  comparePrice: number | null;
  issues: CartIssue[];
  key: string;
  lineTotal: number;
  productId: string;
  purchasable: boolean;
  quantity: number;
  requestedQuantity: number;
  snapshot: CartLineSnapshot | null;
  unitPrice: number;
  variantId: string;
};

export type CartTotals = {
  delivery: number | null;
  discount: number;
  savings: number;
  subtotal: number;
  total: number;
};

export type CartValidation = {
  itemCount: number;
  lines: ValidatedCartLine[];
  removedLines: { key: string; productId: string; variantId: string }[];
  totals: CartTotals;
};

const EMPTY_TOTALS: CartTotals = {
  delivery: null,
  discount: 0,
  savings: 0,
  subtotal: 0,
  total: 0,
};

export const EMPTY_CART_VALIDATION: CartValidation = {
  itemCount: 0,
  lines: [],
  removedLines: [],
  totals: EMPTY_TOTALS,
};

type VariantRow = {
  available: number;
  basePrice: number;
  brandName: string;
  comparePrice: number | null;
  imageAlt: string | null;
  imagePublicId: string | null;
  optionValues: Record<string, string>;
  productComparePrice: number | null;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: string;
  sku: string;
  variantId: string;
  variantPrice: number | null;
  variantStatus: string;
};

async function loadVariants(variantIds: readonly string[]) {
  const rows = await db
    .select({
      available: sql<number>`coalesce(${inventory.available}, 0)::int`,
      basePrice: products.basePrice,
      brandName: brands.name,
      comparePrice: productVariants.comparePrice,
      imageAlt: sql<string | null>`(
        select image.alt from ${productImages} image
        where image.product_id = ${products.id}
        order by image.is_primary desc, image.sort_order asc
        limit 1
      )`,
      imagePublicId: sql<string | null>`(
        select image.cloudinary_public_id from ${productImages} image
        where image.product_id = ${products.id}
        order by image.is_primary desc, image.sort_order asc
        limit 1
      )`,
      optionValues: productVariants.optionValues,
      productComparePrice: products.comparePrice,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productStatus: products.status,
      sku: productVariants.sku,
      variantId: productVariants.id,
      variantPrice: productVariants.price,
      variantStatus: productVariants.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(inArray(productVariants.id, [...variantIds]))
    .limit(variantIds.length);

  return new Map(
    rows.map((row) => [
      row.variantId,
      {
        ...row,
        optionValues: (row.optionValues ?? {}) as Record<string, string>,
      } satisfies VariantRow,
    ]),
  );
}

async function hasPurchasableAlternative(productId: string) {
  const rows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.status, "active"),
        sql`${inventory.available} > 0`,
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function validateCart(
  requested: readonly CartLineInput[],
  options: { deliveryState?: string | undefined } = {},
): Promise<CartValidation> {
  const bounded = requested.slice(0, CART_MAX_LINES);

  if (bounded.length === 0) {
    return EMPTY_CART_VALIDATION;
  }

  const variants = await loadVariants([
    ...new Set(bounded.map((line) => line.variantId)),
  ]);

  const alternativesNeeded = new Set<string>();

  for (const line of bounded) {
    const row = variants.get(line.variantId);

    if (row && row.productStatus === "active" && row.variantStatus !== "active") {
      alternativesNeeded.add(row.productId);
    }
  }

  const alternatives = new Map<string, boolean>(
    await Promise.all(
      [...alternativesNeeded].map(
        async (productId) =>
          [productId, await hasPurchasableAlternative(productId)] as const,
      ),
    ),
  );

  const lines: ValidatedCartLine[] = [];
  const removedLines: CartValidation["removedLines"] = [];

  for (const line of bounded) {
    const key = cartLineKey(line);
    const row = variants.get(line.variantId);
    const requestedQuantity = Math.min(line.quantity, CART_MAX_LINE_QUANTITY);

    if (!row || row.productId !== line.productId || row.productStatus !== "active") {
      removedLines.push({
        key,
        productId: line.productId,
        variantId: line.variantId,
      });

      lines.push({
        availableQuantity: 0,
        comparePrice: null,
        issues: [{ code: "PRODUCT_UNAVAILABLE" }],
        key,
        lineTotal: 0,
        productId: line.productId,
        purchasable: false,
        quantity: 0,
        requestedQuantity,
        snapshot: null,
        unitPrice: 0,
        variantId: line.variantId,
      });

      continue;
    }

    const price = resolveProductPrice({
      basePrice: row.basePrice,
      comparePrice: row.productComparePrice,
      variantComparePrice: row.comparePrice,
      variantPrice: row.variantPrice,
    });

    const snapshot: CartLineSnapshot = {
      brandName: row.brandName,
      imageAlt: row.imageAlt,
      imagePublicId: row.imagePublicId,
      optionValues: row.optionValues,
      productName: row.productName,
      productSlug: row.productSlug,
      sku: row.sku,
    };

    const issues: CartIssue[] = [];

    if (row.variantStatus !== "active") {
      issues.push({ code: "VARIANT_UNAVAILABLE" });

      if (alternatives.get(row.productId) === false) {
        issues.push({ code: "OUT_OF_STOCK" });
      }

      lines.push({
        availableQuantity: 0,
        comparePrice: price.comparePrice,
        issues,
        key,
        lineTotal: 0,
        productId: row.productId,
        purchasable: false,
        quantity: 0,
        requestedQuantity,
        snapshot,
        unitPrice: price.price,
        variantId: row.variantId,
      });

      continue;
    }

    const available = Math.max(0, row.available);
    const quantity = Math.min(requestedQuantity, available);

    if (available === 0) {
      issues.push({ code: "OUT_OF_STOCK" });
    } else if (quantity < requestedQuantity) {
      issues.push({
        code: "QUANTITY_REDUCED",
        requestedQuantity,
        resolvedQuantity: quantity,
      });
    }

    lines.push({
      availableQuantity: available,
      comparePrice: price.comparePrice,
      issues,
      key,
      lineTotal: price.price * quantity,
      productId: row.productId,
      purchasable: quantity > 0,
      quantity,
      requestedQuantity,
      snapshot,
      unitPrice: price.price,
      variantId: row.variantId,
    });
  }

  const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0);

  const savings = lines.reduce((total, line) => {
    if (line.comparePrice === null || line.comparePrice <= line.unitPrice) {
      return total;
    }

    return total + (line.comparePrice - line.unitPrice) * line.quantity;
  }, 0);

  const quote =
    options.deliveryState === undefined ? null : quoteDelivery(options.deliveryState);

  const purchasable = lines.some((line) => line.purchasable);
  const delivery = quote && purchasable ? quote.fee : null;

  return {
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    lines,
    removedLines,
    totals: {
      delivery,
      discount: 0,
      savings,
      subtotal,
      total: subtotal + (delivery ?? 0),
    },
  };
}
