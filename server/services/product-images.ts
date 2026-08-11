import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { MAX_IMAGES_PER_PRODUCT } from "@/constants/media";
import { db } from "@/server/db";
import { productImages, products } from "@/server/db/schema";
import { enqueueMediaCleanup } from "@/server/media/cleanup";
import { uploadProductImage } from "@/server/media/cloudinary";
import {
  validateImageDimensions,
  validateImageUpload,
  type ImageRejectionReason,
} from "@/server/media/image-validation";

export type ProductImageFailure =
  | ImageRejectionReason
  | "product_not_found"
  | "too_many_images"
  | "upload_failed"
  | "not_found";

export type ProductImageResult<T> =
  { data: T; ok: true } | { ok: false; reason: ProductImageFailure };

export type ProductImageRecord = {
  alt: string;
  cloudinaryPublicId: string;
  height: number;
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  width: number;
};

export async function listProductImages(productId: string) {
  return db
    .select({
      alt: productImages.alt,
      cloudinaryPublicId: productImages.cloudinaryPublicId,
      height: productImages.height,
      id: productImages.id,
      isPrimary: productImages.isPrimary,
      sortOrder: productImages.sortOrder,
      width: productImages.width,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
}

export async function addProductImage(input: {
  alt: string;
  bytes: Uint8Array<ArrayBuffer>;
  declaredType: string;
  fileName: string;
  productId: string;
}): Promise<ProductImageResult<ProductImageRecord>> {
  const validation = validateImageUpload({
    bytes: input.bytes,
    declaredType: input.declaredType,
    fileName: input.fileName,
  });

  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const product = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (!product[0]) {
    return { ok: false, reason: "product_not_found" };
  }

  const existing = await db
    .select({ total: count() })
    .from(productImages)
    .where(eq(productImages.productId, input.productId));

  const currentCount = existing[0]?.total ?? 0;

  if (currentCount >= MAX_IMAGES_PER_PRODUCT) {
    return { ok: false, reason: "too_many_images" };
  }

  let uploaded;

  try {
    uploaded = await uploadProductImage({
      bytes: input.bytes,
      contentType: validation.detectedType,
    });
  } catch {
    return { ok: false, reason: "upload_failed" };
  }

  const dimensions = validateImageDimensions({
    height: uploaded.height,
    width: uploaded.width,
  });

  if (!dimensions.ok) {
    await enqueueMediaCleanup(uploaded.publicId, "rejected_upload");

    return { ok: false, reason: dimensions.reason };
  }

  try {
    const inserted = await db
      .insert(productImages)
      .values({
        alt: input.alt,
        cloudinaryPublicId: uploaded.publicId,
        height: uploaded.height,

        isPrimary: currentCount === 0,
        productId: input.productId,
        sortOrder: currentCount,
        width: uploaded.width,
      })
      .returning({
        alt: productImages.alt,
        cloudinaryPublicId: productImages.cloudinaryPublicId,
        height: productImages.height,
        id: productImages.id,
        isPrimary: productImages.isPrimary,
        sortOrder: productImages.sortOrder,
        width: productImages.width,
      });

    const record = inserted[0];

    if (!record) {
      throw new Error("Insert returned no row");
    }

    return { data: record, ok: true };
  } catch {
    await enqueueMediaCleanup(uploaded.publicId, "orphaned_upload");

    return { ok: false, reason: "upload_failed" };
  }
}

export async function removeProductImage(
  imageId: string,
): Promise<ProductImageResult<{ cloudinaryPublicId: string; productId: string }>> {
  const result = await db.execute<{
    cloudinary_public_id: string;
    product_id: string;
  }>(sql`
    with removed as (
      delete from ${productImages}
      where ${productImages.id} = ${imageId}
      returning id, product_id, is_primary, cloudinary_public_id
    ),
    next_primary as (
      select candidate.id
      from ${productImages} candidate
      join removed on removed.product_id = candidate.product_id
      where removed.is_primary = true and candidate.id <> removed.id
      order by candidate.sort_order asc, candidate.created_at asc
      limit 1
    ),
    promoted as (
      update ${productImages}
      set is_primary = true
      where id in (select id from next_primary)
      returning id
    )
    select removed.cloudinary_public_id, removed.product_id from removed
  `);

  const row = result.rows[0];

  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  await enqueueMediaCleanup(row.cloudinary_public_id, "detached_asset");

  return {
    data: { cloudinaryPublicId: row.cloudinary_public_id, productId: row.product_id },
    ok: true,
  };
}

export async function setPrimaryProductImage(
  imageId: string,
): Promise<ProductImageResult<{ productId: string }>> {
  const result = await db.execute<{ product_id: string }>(sql`
    with target as (
      select id, product_id from ${productImages} where ${productImages.id} = ${imageId}
    ),
    updated as (
      update ${productImages}
      set is_primary = (id = (select id from target))
      where product_id = (select product_id from target)
      returning product_id
    )
    select distinct product_id from updated
  `);

  const row = result.rows[0];

  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  return { data: { productId: row.product_id }, ok: true };
}

export async function reorderProductImages(input: {
  imageIds: readonly string[];
  productId: string;
}): Promise<ProductImageResult<{ updated: number }>> {
  let updated = 0;

  for (const [index, imageId] of input.imageIds.entries()) {
    const rows = await db
      .update(productImages)
      .set({ sortOrder: index })
      .where(
        and(
          eq(productImages.id, imageId),
          eq(productImages.productId, input.productId),
        ),
      )
      .returning({ id: productImages.id });

    updated += rows.length;
  }

  return { data: { updated }, ok: true };
}
