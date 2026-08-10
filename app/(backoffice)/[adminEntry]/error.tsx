"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Admin errors may carry a diagnostic reference (MASTER §65) — `digest` is the
 * server-generated correlation id, not the underlying message, so nothing
 * sensitive reaches the browser. Permission denials never land here: they are
 * converted to 404s in `server/auth/guards.ts` so that refused and non-existent
 * look identical.
 */
export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("admin_route_error", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="flex min-h-screen items-center justify-center px-(--page-gutter) py-12">
      <ErrorState
        action={
          <Button onClick={reset} variant="secondary">
            Try again
          </Button>
        }
        className="w-full max-w-md"
        description="This backoffice page could not be loaded. Quote the reference below if you need to report it."
        {...(error.digest ? { correlationId: error.digest } : {})}
      />
    </main>
  );
}
