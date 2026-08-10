import {
  CLOUDINARY_DELIVERY_ORIGIN,
  IMAGE_RATIOS,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageRatio,
} from "@/constants/media";

/**
 * The single place a Cloudinary delivery URL is constructed (primitives/22).
 * No component builds one by hand.
 *
 * Client-safe by design: it reads only the public cloud name, so the same
 * builder serves server components, client components and `srcset` generation.
 */
function getCloudName() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return cloudName && cloudName.length > 0 ? cloudName : null;
}

export function isCloudinaryConfigured() {
  return getCloudName() !== null;
}

export type CloudinaryUrlOptions = {
  ratio?: ImageRatio;
  width: number;
};

/**
 * `f_auto` and `q_auto` are Cloudinary's automatic format and quality
 * negotiation. This is the project's *only* image optimization pipeline —
 * `next/image` is deliberately not layered on top (MEDIA-05, MASTER §53).
 */
function buildTransformation({ ratio, width }: CloudinaryUrlOptions) {
  const parts = ["f_auto", "q_auto", `w_${Math.round(width)}`];

  if (ratio) {
    const { height: ratioHeight, width: ratioWidth } = IMAGE_RATIOS[ratio];

    // c_fill with a fixed aspect ratio guarantees a consistent presentation box
    // whatever shape the admin uploaded; g_auto keeps the subject in frame.
    parts.push(`c_fill`, `ar_${ratioWidth}:${ratioHeight}`, "g_auto");
  } else {
    parts.push("c_limit");
  }

  return parts.join(",");
}

export function buildCloudinaryUrl(publicId: string, options: CloudinaryUrlOptions) {
  const cloudName = getCloudName();

  if (!cloudName) {
    return null;
  }

  const transformation = buildTransformation(options);
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");

  return `${CLOUDINARY_DELIVERY_ORIGIN}/${cloudName}/image/upload/${transformation}/${encodedPublicId}`;
}

export function buildCloudinarySrcSet(
  publicId: string,
  options: Omit<CloudinaryUrlOptions, "width"> & { maxWidth?: number },
) {
  const maxWidth = options.maxWidth ?? Number.POSITIVE_INFINITY;

  const entries = RESPONSIVE_IMAGE_WIDTHS.filter((width) => width <= maxWidth)
    .map((width) => {
      const url = buildCloudinaryUrl(publicId, {
        width,
        ...(options.ratio ? { ratio: options.ratio } : {}),
      });

      return url ? `${url} ${width}w` : null;
    })
    .filter((entry): entry is string => entry !== null);

  return entries.length > 0 ? entries.join(", ") : null;
}

/**
 * Presentation box for a given ratio at a given rendered width. Always emitted
 * as explicit width/height so the browser reserves space and CLS stays at zero.
 */
export function getRatioBox(ratio: ImageRatio, width: number) {
  const { height: ratioHeight, width: ratioWidth } = IMAGE_RATIOS[ratio];

  return {
    height: Math.round((width * ratioHeight) / ratioWidth),
    width,
  };
}
