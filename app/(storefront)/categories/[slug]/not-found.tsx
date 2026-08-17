import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";

export default function CategoryNotFound() {
  return (
    <div className="mx-auto grid w-full max-w-(--page-max) gap-4 px-(--page-gutter) py-12">
      <EmptyState
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-label font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href="/"
          >
            Shop now
          </Link>
        }
        description="This category is no longer available, or the address is incorrect."
        title="Category not found"
      />
    </div>
  );
}
