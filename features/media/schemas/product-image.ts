import { z } from "zod";

import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT } from "@/constants/media";

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

export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES;

export type ProductImageActionState = {
  error: string | null;
  uploadedId: string | null;
};
