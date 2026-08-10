export const CLOUDINARY_DELIVERY_ORIGIN = "https://res.cloudinary.com";
export const CLOUDINARY_API_ORIGIN = "https://api.cloudinary.com";

/** Folder every product asset is uploaded into, so cleanup can be scoped. */
export const PRODUCT_IMAGE_FOLDER = "shopverse/products";

/**
 * Accepted upload formats. The browser-declared MIME type is never trusted —
 * these are matched against the file's magic bytes server-side (SEC-10).
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const ALLOWED_IMAGE_EXTENSIONS: Record<AllowedImageMimeType, readonly string[]> =
  {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/avif": ["avif"],
  };

/** Hard cap enforced before a single byte is forwarded to Cloudinary (SEC-09). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Rejects tracking pixels and decompression-bomb dimensions alike. */
export const MIN_IMAGE_DIMENSION = 400;
export const MAX_IMAGE_DIMENSION = 6000;

export const MAX_IMAGES_PER_PRODUCT = 12;

/**
 * Presentation ratios. Admin uploads may be any shape; the storefront crops to
 * one of these so cards and galleries never jump (MASTER §54, MEDIA-02).
 */
export const IMAGE_RATIOS = {
  square: { height: 1, width: 1 },
  portrait: { height: 5, width: 4 },
  wide: { height: 9, width: 16 },
} as const;

export type ImageRatio = keyof typeof IMAGE_RATIOS;

/** Widths offered in `srcset`. Kept small — every entry is a Cloudinary derivation. */
export const RESPONSIVE_IMAGE_WIDTHS = [
  160, 240, 320, 480, 640, 828, 1080, 1440,
] as const;

export const IMAGE_PLACEHOLDER_BACKGROUND = "#f1efea";
