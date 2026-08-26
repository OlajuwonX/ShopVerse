import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";

export default function ProductNotFound() {
  return (
    <div className="grid gap-4 py-12">
      <EmptyState
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-surface-inverse px-4 text-label font-semibold text-surface hover:bg-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href="/"
          >
            Shop now
          </Link>
        }
        description="This product is no longer available, or the address is incorrect."
        title="Product not found"
      />
    </div>
  );
}
