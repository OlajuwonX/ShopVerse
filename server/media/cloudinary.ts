import "server-only";

import { createHash } from "node:crypto";

import { requireServerEnv } from "@/config/env";
import { CLOUDINARY_API_ORIGIN, PRODUCT_IMAGE_FOLDER } from "@/constants/media";

function getCloudName() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    );
  }

  return cloudName;
}

export function signParams(params: Record<string, string>) {
  const apiSecret = requireServerEnv("CLOUDINARY_API_SECRET");

  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ""}`)
    .join("&");

  return createHash("sha1")
    .update(payload + apiSecret)
    .digest("hex");
}

export type CloudinaryUploadResult = {
  bytes: number;
  format: string;
  height: number;
  publicId: string;
  width: number;
};

type CloudinaryUploadResponse = {
  bytes?: number;
  format?: string;
  height?: number;
  public_id?: string;
  width?: number;
};

export class CloudinaryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CloudinaryError";
  }
}

export async function uploadProductImage(input: {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
}): Promise<CloudinaryUploadResult> {
  const cloudName = getCloudName();
  const apiKey = requireServerEnv("CLOUDINARY_API_KEY");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signedParams: Record<string, string> = {
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp,
  };

  const form = new FormData();
  form.append("file", new Blob([input.bytes], { type: input.contentType }));
  form.append("api_key", apiKey);
  form.append("signature", signParams(signedParams));

  for (const [key, value] of Object.entries(signedParams)) {
    form.append(key, value);
  }

  const response = await fetch(
    `${CLOUDINARY_API_ORIGIN}/v1_1/${cloudName}/image/upload`,
    { body: form, method: "POST" },
  );

  if (!response.ok) {
    throw new CloudinaryError("Cloudinary upload failed", response.status);
  }

  const result = (await response.json()) as CloudinaryUploadResponse;

  if (
    !result.public_id ||
    typeof result.width !== "number" ||
    typeof result.height !== "number"
  ) {
    throw new CloudinaryError("Cloudinary upload returned an unexpected payload");
  }

  return {
    bytes: result.bytes ?? input.bytes.length,
    format: result.format ?? "",
    height: result.height,
    publicId: result.public_id,
    width: result.width,
  };
}

export async function destroyImage(publicId: string) {
  const cloudName = getCloudName();
  const apiKey = requireServerEnv("CLOUDINARY_API_KEY");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signedParams: Record<string, string> = {
    public_id: publicId,
    timestamp,
  };

  const form = new FormData();
  form.append("api_key", apiKey);
  form.append("signature", signParams(signedParams));

  for (const [key, value] of Object.entries(signedParams)) {
    form.append(key, value);
  }

  const response = await fetch(
    `${CLOUDINARY_API_ORIGIN}/v1_1/${cloudName}/image/destroy`,
    { body: form, method: "POST" },
  );

  if (!response.ok) {
    throw new CloudinaryError("Cloudinary destroy failed", response.status);
  }

  const result = (await response.json()) as { result?: string };

  if (result.result !== "ok" && result.result !== "not found") {
    throw new CloudinaryError(`Cloudinary destroy returned "${result.result}"`);
  }

  return result.result;
}
