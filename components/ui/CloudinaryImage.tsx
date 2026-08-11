/* eslint-disable @next/next/no-img-element */
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

  displayWidth: number;

  priority?: boolean;
  publicId: string | null | undefined;
  ratio: ImageRatio;

  sizes: string;
};

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
