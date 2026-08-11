export const CLOUDINARY_DELIVERY_ORIGIN = "https://res.cloudinary.com";
export const CLOUDINARY_API_ORIGIN = "https://api.cloudinary.com";

export const PRODUCT_IMAGE_FOLDER = "shopverse/products";

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

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const MIN_IMAGE_DIMENSION = 400;
export const MAX_IMAGE_DIMENSION = 6000;

export const MAX_IMAGES_PER_PRODUCT = 12;

export const IMAGE_RATIOS = {
  square: { height: 1, width: 1 },
  portrait: { height: 5, width: 4 },
  wide: { height: 9, width: 16 },
} as const;

export type ImageRatio = keyof typeof IMAGE_RATIOS;

export const RESPONSIVE_IMAGE_WIDTHS = [
  160, 240, 320, 480, 640, 828, 1080, 1440,
] as const;

export const IMAGE_PLACEHOLDER_BACKGROUND = "#f1efea";
