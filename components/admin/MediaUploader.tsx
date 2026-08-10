"use client";

import { UploadCloud } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/constants/media";
import { uploadProductImageAction } from "@/features/media/actions/product-images";
import type { ProductImageActionState } from "@/features/media/schemas/product-image";

const initialState: ProductImageActionState = { error: null, uploadedId: null };

const MAX_MEGABYTES = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

type MediaUploaderProps = {
  productId: string;
};

/**
 * Admin upload primitive. Stage 32 mounts this inside the product editor.
 *
 * The client-side size and type checks exist purely to fail fast — the server
 * re-validates every one of them from the file's magic bytes, and the browser's
 * declared MIME type is never trusted (SEC-08, SEC-09, SEC-10).
 */
export function MediaUploader({ productId }: MediaUploaderProps) {
  const [state, formAction, isPending] = useActionState(
    uploadProductImageAction,
    initialState,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setClientError(null);
      setFileName(null);

      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setClientError(`That file is larger than ${MAX_MEGABYTES}MB.`);
      setFileName(file.name);

      return;
    }

    setClientError(null);
    setFileName(file.name);
  }

  const message = clientError ?? state.error;

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-lg border border-border bg-surface-raised p-4"
      ref={formRef}
    >
      <input name="productId" type="hidden" value={productId} />

      <div className="grid gap-2 text-label font-semibold text-text">
        <label htmlFor="product-image-file">Image file</label>
        <input
          accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
          className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text file:mr-3 file:min-h-8 file:rounded-md file:border file:border-border file:bg-surface-raised file:px-3 file:text-label file:font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          id="product-image-file"
          name="file"
          onChange={handleFileChange}
          required
          type="file"
        />
        <span className="text-caption font-normal text-text-muted">
          JPEG, PNG, WebP or AVIF. Up to {MAX_MEGABYTES}MB, at least 400px on the
          shortest side.
        </span>
      </div>

      <Input
        hint="Describe the product as it appears in this image."
        label="Alt text"
        maxLength={160}
        name="alt"
        required
        type="text"
      />

      <p aria-live="polite" className="min-h-5 text-body-sm text-danger" role="status">
        {message}
      </p>

      {state.uploadedId && !message ? (
        <p aria-live="polite" className="text-body-sm text-success" role="status">
          Image added{fileName ? `: ${fileName}` : ""}.
        </p>
      ) : null}

      <Button isLoading={isPending} type="submit">
        <UploadCloud aria-hidden="true" className="size-4" />
        Upload image
      </Button>
    </form>
  );
}
