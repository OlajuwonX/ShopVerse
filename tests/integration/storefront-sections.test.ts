import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { hasRealDatabase } from "@/tests/setup/env";
import { db } from "@/server/db";
import { storefrontSections } from "@/server/db/schema";
import {
  listActiveSections,
  listCollectionProducts,
  listSectionBrands,
  listSectionCategories,
} from "@/server/services/storefront";

const FIXTURE_PREFIX = "vitest-fixture-";

type SectionFixture = {
  endsAt?: Date | null;
  isActive?: boolean;
  slug: string;
  sortOrder?: number;
  startsAt?: Date | null;
};

async function createSection(fixture: SectionFixture) {
  await db.insert(storefrontSections).values({
    desktopConfig: {},
    endsAt: fixture.endsAt ?? null,
    isActive: fixture.isActive ?? true,
    mobileConfig: {},
    slug: fixture.slug,
    sortOrder: fixture.sortOrder ?? 500,
    sourceKind: "trending",
    startsAt: fixture.startsAt ?? null,
    title: `Fixture ${fixture.slug}`,
    type: "product_rail",
  });
}

async function removeFixtures() {
  const rows = await db
    .select({ slug: storefrontSections.slug })
    .from(storefrontSections);

  for (const row of rows) {
    if (row.slug.startsWith(FIXTURE_PREFIX)) {
      await db.delete(storefrontSections).where(eq(storefrontSections.slug, row.slug));
    }
  }
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

describe.skipIf(!hasRealDatabase)("listActiveSections scheduling (ADM-05)", () => {
  afterEach(async () => {
    await removeFixtures();
  });

  it("includes a section with no schedule", async () => {
    const slug = `${FIXTURE_PREFIX}always-on`;
    await createSection({ slug });

    const slugs = (await listActiveSections()).map((section) => section.slug);

    expect(slugs).toContain(slug);
  });

  it("excludes a section whose window has closed", async () => {
    const slug = `${FIXTURE_PREFIX}expired`;
    await createSection({ endsAt: hoursFromNow(-1), slug, startsAt: hoursFromNow(-2) });

    const slugs = (await listActiveSections()).map((section) => section.slug);

    expect(slugs).not.toContain(slug);
  });

  it("excludes a section whose window has not opened", async () => {
    const slug = `${FIXTURE_PREFIX}future`;
    await createSection({ slug, startsAt: hoursFromNow(1) });

    const slugs = (await listActiveSections()).map((section) => section.slug);

    expect(slugs).not.toContain(slug);
  });

  it("includes a section inside its window", async () => {
    const slug = `${FIXTURE_PREFIX}current`;
    await createSection({ endsAt: hoursFromNow(1), slug, startsAt: hoursFromNow(-1) });

    const slugs = (await listActiveSections()).map((section) => section.slug);

    expect(slugs).toContain(slug);
  });

  it("excludes an inactive section regardless of its window", async () => {
    const slug = `${FIXTURE_PREFIX}inactive`;
    await createSection({ isActive: false, slug });

    const slugs = (await listActiveSections()).map((section) => section.slug);

    expect(slugs).not.toContain(slug);
  });

  it("orders sections by sortOrder", async () => {
    const sections = await listActiveSections();
    const orders = sections.map((section) => section.sortOrder);

    expect(orders).toStrictEqual([...orders].sort((a, b) => a - b));
  });
});

describe.skipIf(!hasRealDatabase)("listActiveSections payload", () => {
  it("returns the seeded storefront with parsed configuration", async () => {
    const sections = await listActiveSections();

    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(typeof section.desktopConfig).toBe("object");
      expect(typeof section.mobileConfig).toBe("object");
      expect(section.title.length).toBeGreaterThan(0);
    }
  });

  it("joins a bound campaign for campaign sections", async () => {
    const sections = await listActiveSections();
    const campaignSections = sections.filter((section) =>
      ["promo_banner", "split_campaign"].includes(section.type),
    );

    expect(campaignSections.length).toBeGreaterThan(0);

    for (const section of campaignSections) {
      expect(section.campaign).not.toBeNull();
      expect(section.campaign?.title.length).toBeGreaterThan(0);
    }
  });

  it("joins a bound collection for collection sections", async () => {
    const sections = await listActiveSections();
    const collectionSections = sections.filter(
      (section) => section.sourceKind === "collection",
    );

    expect(collectionSections.length).toBeGreaterThan(0);
    expect(collectionSections.every((section) => section.collectionId !== null)).toBe(
      true,
    );
  });
});

describe.skipIf(!hasRealDatabase)("section data sources", () => {
  it("returns manual collection members in sort order, bounded by the limit", async () => {
    const sections = await listActiveSections();
    const manual = sections.find(
      (section) => section.collectionType === "manual" && section.collectionId,
    );

    expect(manual).toBeDefined();

    const items = await listCollectionProducts(manual?.collectionId ?? "", 4);

    expect(items.length).toBe(4);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.every((item) => Number.isInteger(item.basePrice))).toBe(true);
  });

  it("returns an empty list for a collection with no members", async () => {
    expect(
      await listCollectionProducts("00000000-0000-4000-8000-000000000000", 10),
    ).toStrictEqual([]);
  });

  it("returns root categories when no parent is given", async () => {
    const categories = await listSectionCategories(null, 10);

    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
  });

  it("returns the children of a named parent", async () => {
    const children = await listSectionCategories("electronics", 10);

    expect(children.length).toBeGreaterThan(0);
    expect(children.map((c) => c.slug)).not.toContain("electronics");
  });

  it("bounds brand rails and returns distinct brands", async () => {
    const brands = await listSectionBrands(5);

    expect(brands.length).toBe(5);
    expect(new Set(brands.map((b) => b.slug)).size).toBe(brands.length);
  });
});
