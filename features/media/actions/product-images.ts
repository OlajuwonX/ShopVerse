"use server";

import { MAX_IMAGE_BYTES } from "@/constants/media";
import {
  productImageIdSchema,
  reorderProductImagesSchema,
  uploadProductImageSchema,
  type ProductImageActionState,
} from "@/features/media/schemas/product-image";
import { PermissionDeniedError, requirePermission } from "@/server/auth/permissions";
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
  setPrimaryProductImage,
  type ProductImageFailure,
} from "@/server/services/product-images";
import { writeAuditLog } from "@/server/security/audit";
import { assertSameOrigin } from "@/server/security/origin";

const FAILURE_MESSAGES: Record<ProductImageFailure, string> = {
  dimensions_too_large: "That image is larger than 6000px on its longest side.",
  dimensions_too_small: "That image is smaller than 400px on its shortest side.",
  empty_file: "That file is empty.",
  extension_mismatch: "The file extension does not match the actual image format.",
  not_found: "That image no longer exists.",
  product_not_found: "That product no longer exists.",
  too_large: `That file is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
  too_many_images: "This product already has the maximum number of images.",
  unsupported_format: "That file is not a JPEG, PNG, WebP or AVIF image.",
  unsupported_type: "That image format is not accepted.",
  upload_failed: "The image could not be stored. Try again.",
};

const GENERIC_DENIAL = "You do not have access to that.";

function denialState(): ProductImageActionState {
  return { error: GENERIC_DENIAL, uploadedId: null };
}

export async function uploadProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  await assertSameOrigin();

  let actor;

  try {
    actor = await requirePermission("products.update");
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return denialState();
    }

    throw error;
  }

  const parsed = uploadProductImageSchema.safeParse({
    alt: formData.get("alt"),
    productId: formData.get("productId"),
  });

  if (!parsed.success) {
    return { error: "Check the image details and try again.", uploadedId: null };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "Choose an image to upload.", uploadedId: null };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: FAILURE_MESSAGES.too_large, uploadedId: null };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const result = await addProductImage({
    alt: parsed.data.alt,
    bytes,
    declaredType: file.type,
    fileName: file.name,
    productId: parsed.data.productId,
  });

  if (!result.ok) {
    await writeAuditLog({
      action: "product_image.upload.rejected",
      actorId: actor.userId,
      actorType: "staff",
      after: { reason: result.reason },
      targetId: parsed.data.productId,
      targetType: "product",
    });

    return { error: FAILURE_MESSAGES[result.reason], uploadedId: null };
  }

  await writeAuditLog({
    action: "product_image.uploaded",
    actorId: actor.userId,
    actorType: "staff",
    after: {
      cloudinaryPublicId: result.data.cloudinaryPublicId,
      height: result.data.height,
      imageId: result.data.id,
      width: result.data.width,
    },
    targetId: parsed.data.productId,
    targetType: "product",
  });

  return { error: null, uploadedId: result.data.id };
}

export async function deleteProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  await assertSameOrigin();

  let actor;

  try {
    actor = await requirePermission("products.update");
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return denialState();
    }

    throw error;
  }

  const parsed = productImageIdSchema.safeParse({ imageId: formData.get("imageId") });

  if (!parsed.success) {
    return { error: FAILURE_MESSAGES.not_found, uploadedId: null };
  }

  const result = await removeProductImage(parsed.data.imageId);

  if (!result.ok) {
    return { error: FAILURE_MESSAGES[result.reason], uploadedId: null };
  }

  await writeAuditLog({
    action: "product_image.deleted",
    actorId: actor.userId,
    actorType: "staff",
    before: {
      cloudinaryPublicId: result.data.cloudinaryPublicId,
      imageId: parsed.data.imageId,
    },
    targetId: result.data.productId,
    targetType: "product",
  });

  return { error: null, uploadedId: null };
}

export async function setPrimaryProductImageAction(
  _previousState: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  await assertSameOrigin();

  let actor;

  try {
    actor = await requirePermission("products.update");
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return denialState();
    }

    throw error;
  }

  const parsed = productImageIdSchema.safeParse({ imageId: formData.get("imageId") });

  if (!parsed.success) {
    return { error: FAILURE_MESSAGES.not_found, uploadedId: null };
  }

  const result = await setPrimaryProductImage(parsed.data.imageId);

  if (!result.ok) {
    return { error: FAILURE_MESSAGES[result.reason], uploadedId: null };
  }

  await writeAuditLog({
    action: "product_image.primary_changed",
    actorId: actor.userId,
    actorType: "staff",
    after: { imageId: parsed.data.imageId },
    targetId: result.data.productId,
    targetType: "product",
  });

  return { error: null, uploadedId: null };
}

export async function reorderProductImagesAction(input: {
  imageIds: readonly string[];
  productId: string;
}): Promise<ProductImageActionState> {
  await assertSameOrigin();

  let actor;

  try {
    actor = await requirePermission("products.update");
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return denialState();
    }

    throw error;
  }

  const parsed = reorderProductImagesSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "That ordering is not valid.", uploadedId: null };
  }

  const result = await reorderProductImages({
    imageIds: parsed.data.imageIds,
    productId: parsed.data.productId,
  });

  if (!result.ok) {
    return { error: FAILURE_MESSAGES[result.reason], uploadedId: null };
  }

  await writeAuditLog({
    action: "product_image.reordered",
    actorId: actor.userId,
    actorType: "staff",
    after: { imageIds: parsed.data.imageIds },
    targetId: parsed.data.productId,
    targetType: "product",
  });

  return { error: null, uploadedId: null };
}
