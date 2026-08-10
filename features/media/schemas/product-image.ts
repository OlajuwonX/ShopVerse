import { z } from "zod";

import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT } from "@/constants/media";

/**
 * Explicit allowlist schemas. Nothing is spread from the submitted form into a
 * database write, so unknown fields cannot ride along (SEC-05).
 */
export const uploadProductImageSchema = z.object({
  alt: z.string().trim().min(1).max(160),
  productId: z.string().uuid(),
});

export const productImageIdSchema = z.object({
  imageId: z.string().uuid(),
});

export const reorderProductImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1).max(MAX_IMAGES_PER_PRODUCT),
  productId: z.string().uuid(),
});

/** Mirrors the server-side byte cap so the browser can fail fast (SEC-09). */
export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES;

export type ProductImageActionState = {
  error: string | null;
  uploadedId: string | null;
};
