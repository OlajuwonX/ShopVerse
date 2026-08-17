import {
  CLOUDINARY_DELIVERY_ORIGIN,
  IMAGE_RATIOS,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageRatio,
} from "@/constants/media";

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

function buildTransformation({ ratio, width }: CloudinaryUrlOptions) {
  const parts = ["f_auto", "q_auto", `w_${Math.round(width)}`];

  if (ratio) {
    const { height: ratioHeight, width: ratioWidth } = IMAGE_RATIOS[ratio];

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
  const encodedPublicId = publicId
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");

  if (encodedPublicId.length === 0) {
    return null;
  }

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

export function getRatioBox(ratio: ImageRatio, width: number) {
  const { height: ratioHeight, width: ratioWidth } = IMAGE_RATIOS[ratio];

  return {
    height: Math.round((width * ratioHeight) / ratioWidth),
    width,
  };
}
