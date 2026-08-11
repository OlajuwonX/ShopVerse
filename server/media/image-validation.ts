import "server-only";

import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  type AllowedImageMimeType,
} from "@/constants/media";

export type ImageRejectionReason =
  | "dimensions_too_large"
  | "dimensions_too_small"
  | "empty_file"
  | "extension_mismatch"
  | "too_large"
  | "unsupported_format"
  | "unsupported_type";

export type ImageValidationResult =
  | { detectedType: AllowedImageMimeType; ok: true }
  | { ok: false; reason: ImageRejectionReason };

function hasBytes(bytes: Uint8Array, offset: number, signature: readonly number[]) {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function hasAscii(bytes: Uint8Array, offset: number, text: string) {
  return hasBytes(
    bytes,
    offset,
    [...text].map((character) => character.charCodeAt(0)),
  );
}

export function detectImageType(bytes: Uint8Array): AllowedImageMimeType | null {
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP")) {
    return "image/webp";
  }

  if (
    hasAscii(bytes, 4, "ftyp") &&
    (hasAscii(bytes, 8, "avif") || hasAscii(bytes, 8, "avis"))
  ) {
    return "image/avif";
  }

  return null;
}

function extensionOf(fileName: string) {
  const parts = fileName.toLowerCase().split(".");

  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function validateImageUpload(input: {
  bytes: Uint8Array;
  declaredType: string;
  fileName: string;
}): ImageValidationResult {
  if (input.bytes.length === 0) {
    return { ok: false, reason: "empty_file" };
  }

  if (input.bytes.length > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const detectedType = detectImageType(input.bytes);

  if (!detectedType) {
    return { ok: false, reason: "unsupported_format" };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(detectedType)) {
    return { ok: false, reason: "unsupported_type" };
  }

  const extension = extensionOf(input.fileName);

  if (extension && !ALLOWED_IMAGE_EXTENSIONS[detectedType].includes(extension)) {
    return { ok: false, reason: "extension_mismatch" };
  }

  return { detectedType, ok: true };
}

export function validateImageDimensions(dimensions: {
  height: number;
  width: number;
}): ImageValidationResult | { ok: true } {
  const smallest = Math.min(dimensions.width, dimensions.height);
  const largest = Math.max(dimensions.width, dimensions.height);

  if (smallest < MIN_IMAGE_DIMENSION) {
    return { ok: false, reason: "dimensions_too_small" };
  }

  if (largest > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: "dimensions_too_large" };
  }

  return { ok: true };
}
