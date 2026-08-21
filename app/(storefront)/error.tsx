"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid gap-4 py-12">
      <ErrorState
        description="Something went wrong loading this page. Your cart and account are unaffected."
        title="This page could not be loaded"
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        {error.digest ? (
          <p className="text-caption text-text-subtle">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
