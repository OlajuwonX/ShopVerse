import { Suspense } from "react";

import { SectionRenderer } from "@/components/storefront/SectionRenderer";
import { SectionSkeleton } from "@/components/storefront/SectionShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCachedActiveSections, resolveSection } from "@/server/cache/storefront";
import type { StorefrontSection } from "@/server/services/storefront";

export const revalidate = 60;

const ABOVE_FOLD_SECTIONS = 2;

async function Section({
  isAboveFold,
  section,
}: {
  isAboveFold: boolean;
  section: StorefrontSection;
}) {
  const resolved = await resolveSection(section);

  return <SectionRenderer isAboveFold={isAboveFold} resolved={resolved} />;
}

export default async function HomePage() {
  const sections = await getCachedActiveSections();

  return (
    <div className="mx-auto grid w-full max-w-(--page-max) gap-10 px-(--page-gutter) py-6">
      <h1 className="sr-only">ShopVerse — shop electronics, fashion, home and more</h1>

      {sections.length === 0 ? (
        <EmptyState
          description="No storefront sections are active yet. Sections are created and scheduled from the backoffice."
          title="Nothing to show yet"
        />
      ) : (
        sections.map((section, index) => (
          <Suspense fallback={<SectionSkeleton />} key={section.id}>
            <Section isAboveFold={index < ABOVE_FOLD_SECTIONS} section={section} />
          </Suspense>
        ))
      )}
    </div>
  );
}
