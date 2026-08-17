import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, RESPONSIVE_IMAGE_WIDTHS } from "@/constants/media";
import {
  buildCloudinarySrcSet,
  buildCloudinaryUrl,
  getRatioBox,
} from "@/lib/media/cloudinary-url";
import {
  detectImageType,
  validateImageDimensions,
  validateImageUpload,
} from "@/server/media/image-validation";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function webp() {
  const bytes = new Uint8Array(16);
  bytes.set(
    [..."RIFF"].map((c) => c.charCodeAt(0)),
    0,
  );
  bytes.set(
    [..."WEBP"].map((c) => c.charCodeAt(0)),
    8,
  );

  return bytes;
}

describe("buildCloudinaryUrl", () => {
  it("requests automatic format and quality once, not twice (MEDIA-05)", () => {
    const url = buildCloudinaryUrl("shopverse/products/sample", { width: 320 });

    expect(url).toContain("f_auto");
    expect(url).toContain("q_auto");
    expect(url?.match(/f_auto/g)).toHaveLength(1);
  });

  it("pins a consistent presentation ratio when one is requested (MEDIA-02)", () => {
    const url = buildCloudinaryUrl("shopverse/products/sample", {
      ratio: "square",
      width: 320,
    });

    expect(url).toContain("c_fill");
    expect(url).toContain("ar_1:1");
  });

  it("limits rather than crops when no ratio is requested", () => {
    const url = buildCloudinaryUrl("shopverse/products/sample", { width: 320 });

    expect(url).toContain("c_limit");
    expect(url).not.toContain("c_fill");
  });

  it("delivers only from the allowlisted Cloudinary origin", () => {
    const url = buildCloudinaryUrl("shopverse/products/sample", { width: 320 });

    expect(url?.startsWith("https://res.cloudinary.com/")).toBe(true);
  });

  it("drops traversal segments so a crafted public id cannot escape the path", () => {
    const url = buildCloudinaryUrl("shopverse/../../etc/passwd", { width: 320 });

    expect(url).not.toContain("..");
    expect(url).toContain("/shopverse/etc/passwd");
  });

  it("returns null when a public id has no usable segments", () => {
    expect(buildCloudinaryUrl("../..", { width: 320 })).toBeNull();
    expect(buildCloudinaryUrl("///", { width: 320 })).toBeNull();
  });

  it("encodes spaces and query characters in the public id", () => {
    const url = buildCloudinaryUrl("folder/my image?x=1", { width: 320 });

    expect(url).not.toContain(" ");
    expect(url).not.toContain("?");
  });
});

describe("buildCloudinarySrcSet", () => {
  it("offers the full responsive width ladder", () => {
    const srcSet = buildCloudinarySrcSet("shopverse/products/sample", {
      ratio: "square",
    });

    expect(srcSet?.split(", ")).toHaveLength(RESPONSIVE_IMAGE_WIDTHS.length);
    expect(srcSet).toContain("160w");
  });

  it("never offers a candidate wider than the cap", () => {
    const srcSet = buildCloudinarySrcSet("shopverse/products/sample", {
      maxWidth: 480,
      ratio: "square",
    });

    const widths = [...(srcSet ?? "").matchAll(/ (\d+)w/g)].map((m) => Number(m[1]));

    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeLessThanOrEqual(480);
  });
});

describe("getRatioBox", () => {
  it("reserves an exact box so the layout cannot shift (MEDIA-01)", () => {
    expect(getRatioBox("square", 400)).toStrictEqual({ height: 400, width: 400 });
    expect(getRatioBox("wide", 640)).toStrictEqual({ height: 360, width: 640 });
    expect(getRatioBox("portrait", 400)).toStrictEqual({ height: 500, width: 400 });
  });
});

describe("detectImageType", () => {
  it("identifies supported formats by signature, not by claim", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(webp())).toBe("image/webp");
  });

  it("returns null for content that is not an image", () => {
    expect(detectImageType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(detectImageType(new Uint8Array([0x4d, 0x5a]))).toBeNull();
  });
});

describe("validateImageUpload (SEC-08, SEC-09, SEC-10)", () => {
  it("accepts a genuine image with a matching extension", () => {
    expect(
      validateImageUpload({
        bytes: JPEG,
        declaredType: "image/jpeg",
        fileName: "photo.jpg",
      }),
    ).toStrictEqual({ detectedType: "image/jpeg", ok: true });
  });

  it("rejects a script disguised as an image regardless of the declared type", () => {
    const html = new Uint8Array(
      [..."<script>alert(1)</script>"].map((c) => c.charCodeAt(0)),
    );

    expect(
      validateImageUpload({
        bytes: html,
        declaredType: "image/png",
        fileName: "payload.png",
      }),
    ).toStrictEqual({ ok: false, reason: "unsupported_format" });
  });

  it("rejects a MIME/extension mismatch (SEC-10)", () => {
    expect(
      validateImageUpload({
        bytes: PNG,
        declaredType: "image/png",
        fileName: "actually.jpg",
      }),
    ).toStrictEqual({ ok: false, reason: "extension_mismatch" });
  });

  it("rejects an oversized upload before processing it (SEC-09)", () => {
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    oversized.set(JPEG, 0);

    expect(
      validateImageUpload({
        bytes: oversized,
        declaredType: "image/jpeg",
        fileName: "big.jpg",
      }),
    ).toStrictEqual({ ok: false, reason: "too_large" });
  });

  it("rejects an empty file", () => {
    expect(
      validateImageUpload({
        bytes: new Uint8Array(0),
        declaredType: "image/jpeg",
        fileName: "empty.jpg",
      }),
    ).toStrictEqual({ ok: false, reason: "empty_file" });
  });

  it("does not trust the declared type when the bytes disagree", () => {
    const result = validateImageUpload({
      bytes: PNG,
      declaredType: "image/jpeg",
      fileName: "image.png",
    });

    expect(result).toStrictEqual({ detectedType: "image/png", ok: true });
  });
});

describe("validateImageDimensions", () => {
  it("rejects images that are too small or too large", () => {
    expect(validateImageDimensions({ height: 399, width: 800 })).toStrictEqual({
      ok: false,
      reason: "dimensions_too_small",
    });
    expect(validateImageDimensions({ height: 400, width: 6001 })).toStrictEqual({
      ok: false,
      reason: "dimensions_too_large",
    });
  });

  it("accepts images inside the bounds", () => {
    expect(validateImageDimensions({ height: 1200, width: 1200 })).toStrictEqual({
      ok: true,
    });
  });
});
