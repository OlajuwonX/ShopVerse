import type { Metadata } from "next";
import { z } from "zod";

import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { SEARCH_MAX_LENGTH } from "@/components/ui/SearchInput";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
  title: "Search",
};

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional().catch(undefined),
});

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const parsed = searchParamsSchema.safeParse(await searchParams);
  const term = parsed.success ? parsed.data.q : undefined;

  return (
    <div className="mx-auto grid w-full max-w-(--page-max) gap-6 px-(--page-gutter) py-8">
      <Breadcrumb
        items={[
          { href: "/", label: "Home" },
          { label: "Search" },
          ...(term ? [{ label: `"${term}"` }] : []),
        ]}
      />

      <h1 className="text-heading-2 font-bold text-text">
        {term ? `Results for "${term}"` : "Search ShopVerse"}
      </h1>

      {term ? (
        <EmptyState
          description="The search shell accepts and validates the query, and the URL is shareable. Ranked product, category and brand results arrive in Stage 21."
          title="Search results are not built yet"
        />
      ) : (
        <EmptyState
          description="Use the search field in the header to look for products, categories and brands."
          title="Enter a search term"
        />
      )}
    </div>
  );
}
