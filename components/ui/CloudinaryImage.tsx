/* eslint-disable @next/next/no-img-element -- Cloudinary is this project's single
   image optimization pipeline (MEDIA-05, MASTER §53). Rendering through next/image
   would re-optimize an asset that f_auto/q_auto has already optimized, and would
   also consume Vercel's image-optimization allowance. This file is the one place
   a raw <img> is permitted; every other component renders through it. */
import { ImageOff } from "lucide-react";

import { IMAGE_PLACEHOLDER_BACKGROUND, type ImageRatio } from "@/constants/media";
import { cn } from "@/lib/cn";
import {
  buildCloudinarySrcSet,
  buildCloudinaryUrl,
  getRatioBox,
} from "@/lib/media/cloudinary-url";

type CloudinaryImageProps = {
  alt: string;
  className?: string;
  /** Rendered width used to derive the reserved box. Not a hard display width. */
  displayWidth: number;
  /** Above-the-fold LCP candidates only. Everything else stays lazy. */
  priority?: boolean;
  publicId: string | null | undefined;
  ratio: ImageRatio;
  /** Real layout widths per breakpoint, so the browser picks the right source. */
  sizes: string;
};

/**
 * The project's only image delivery path.
 *
 * `next/image` is deliberately not used: Cloudinary already performs format and
 * quality negotiation via `f_auto`/`q_auto`, and layering Next.js optimization
 * on top would re-encode an already-optimized asset — the double-optimization
 * defect in MEDIA-05 / MASTER §53. Choosing Cloudinary as the single pipeline
 * also keeps the build inside Vercel's free image-optimization allowance.
 *
 * Width and height are always emitted so the browser reserves the box before
 * the bytes arrive; a missing or unconfigured asset renders the same box as a
 * placeholder, so layout never shifts (MEDIA-01, PERF-04).
 */
export function CloudinaryImage({
  alt,
  className,
  displayWidth,
  priority = false,
  publicId,
  ratio,
  sizes,
}: CloudinaryImageProps) {
  const box = getRatioBox(ratio, displayWidth);
  const source = publicId
    ? buildCloudinaryUrl(publicId, { ratio, width: displayWidth })
    : null;
  const srcSet = publicId ? buildCloudinarySrcSet(publicId, { ratio }) : null;

  if (!source) {
    return (
      <div
        aria-hidden={alt === "" ? true : undefined}
        className={cn(
          "flex items-center justify-center rounded-md border border-border text-text-subtle",
          className,
        )}
        role={alt === "" ? undefined : "img"}
        aria-label={alt === "" ? undefined : alt}
        style={{
          aspectRatio: `${box.width} / ${box.height}`,
          background: IMAGE_PLACEHOLDER_BACKGROUND,
        }}
      >
        <ImageOff aria-hidden="true" className="size-6" />
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={cn("h-auto w-full rounded-md object-cover", className)}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      height={box.height}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      src={source}
      {...(srcSet ? { srcSet } : {})}
      style={{
        aspectRatio: `${box.width} / ${box.height}`,
        background: IMAGE_PLACEHOLDER_BACKGROUND,
      }}
      width={box.width}
    />
  );
}
