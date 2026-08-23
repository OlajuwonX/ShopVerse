import { z } from "zod";

import { CART_MAX_LINE_QUANTITY, CART_MAX_LINES } from "@/constants/cart";

export const cartLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(CART_MAX_LINE_QUANTITY),
  variantId: z.uuid(),
});

export type CartLineInput = z.infer<typeof cartLineInputSchema>;

export const cartValidationRequestSchema = z.object({
  lines: z.array(cartLineInputSchema).max(CART_MAX_LINES),
});

export type CartValidationRequest = z.infer<typeof cartValidationRequestSchema>;

export const storedCartLineSchema = cartLineInputSchema.extend({
  lastSeenUnitPrice: z.number().int().min(0).nullable(),
});

export type StoredCartLine = z.infer<typeof storedCartLineSchema>;

export const storedCartSchema = z.object({
  lines: z.array(storedCartLineSchema).max(CART_MAX_LINES),
  version: z.literal(1),
});

export function cartLineKey(line: { productId: string; variantId: string }) {
  return `${line.productId}:${line.variantId}`;
}

export function toCartLineInputs(lines: readonly StoredCartLine[]): CartLineInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    variantId: line.variantId,
  }));
}

export function normaliseStoredCart(lines: readonly unknown[]): StoredCartLine[] {
  const byKey = new Map<string, StoredCartLine>();

  for (const entry of lines) {
    const parsed = storedCartLineSchema.safeParse(entry);

    if (!parsed.success) {
      continue;
    }

    const key = cartLineKey(parsed.data);
    const existing = byKey.get(key);

    if (existing) {
      existing.quantity = Math.min(
        existing.quantity + parsed.data.quantity,
        CART_MAX_LINE_QUANTITY,
      );

      continue;
    }

    if (byKey.size === CART_MAX_LINES) {
      continue;
    }

    byKey.set(key, { ...parsed.data });
  }

  return [...byKey.values()];
}
