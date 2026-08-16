import { neon } from "@neondatabase/serverless";
import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { toMinorUnits } from "@/lib/money";
import * as schema from "@/server/db/schema";

const { campaigns, collectionProducts, collections, products, storefrontSections } =
  schema;

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function createClient() {
  return drizzle(neon(requireEnv("DATABASE_URL")), { schema });
}

type Client = ReturnType<typeof createClient>;

const seedCollections = [
  {
    description: "A hand-picked shortlist from the ShopVerse merchandising team.",
    name: "Editor's Picks",
    rules: null,
    slug: "editors-picks",
    sortOrder: 0,
    type: "manual" as const,
  },
  {
    description: "Everything worth buying under ₦100,000.",
    name: "Under ₦100,000",
    rules: { inStockOnly: true, maxPrice: toMinorUnits(100_000), sort: "price_asc" },
    slug: "under-100000",
    sortOrder: 10,
    type: "dynamic" as const,
  },
];

const seedCampaigns = [
  {
    content: {
      body: "Free delivery on electronics over ₦150,000 this week only.",
      eyebrow: "This week",
    },
    href: null,
    slug: "tech-week",
    sortOrder: 0,
    title: "Tech Week is live",
    type: "promo_banner" as const,
  },
  {
    content: {
      body: "New furniture arrivals, built for small spaces.",
      eyebrow: "Home refresh",
      secondaryBody: "Beauty restocks landed too, with everyday prices held flat.",
    },
    href: null,
    slug: "home-refresh",
    sortOrder: 10,
    title: "Refresh your space",
    type: "split_campaign" as const,
  },
];

type SeedSection = {
  collectionSlug?: string;
  campaignSlug?: string;
  sortOrder: number;
  sourceKind: (typeof storefrontSections.$inferInsert)["sourceKind"];
  sourceRef?: string;
  slug: string;
  title: string;
  type: (typeof storefrontSections.$inferInsert)["type"];
  viewMoreHref?: string;
  desktopConfig?: Record<string, number>;
};

const seedSections: readonly SeedSection[] = [
  {
    campaignSlug: "tech-week",
    slug: "tech-week-banner",
    sortOrder: 0,
    sourceKind: "manual",
    title: "Tech Week is live",
    type: "promo_banner",
  },
  {
    desktopConfig: { itemLimit: 12 },
    slug: "trending-now",
    sortOrder: 10,
    sourceKind: "trending",
    title: "Trending now",
    type: "product_rail",
  },
  {
    desktopConfig: { itemLimit: 12 },
    slug: "offers-rail",
    sortOrder: 20,
    sourceKind: "offers",
    title: "Offers",
    type: "product_rail",
  },
  {
    desktopConfig: { itemLimit: 10 },
    slug: "shop-by-category",
    sortOrder: 30,
    sourceKind: "manual",
    title: "Shop by category",
    type: "category_rail",
  },
  {
    desktopConfig: { itemLimit: 12 },
    slug: "new-arrivals-rail",
    sortOrder: 40,
    sourceKind: "new_arrivals",
    title: "New arrivals",
    type: "product_rail",
  },
  {
    campaignSlug: "home-refresh",
    slug: "home-refresh-split",
    sortOrder: 50,
    sourceKind: "manual",
    title: "Refresh your space",
    type: "split_campaign",
  },
  {
    collectionSlug: "editors-picks",
    desktopConfig: { itemLimit: 8 },
    slug: "editors-picks-rail",
    sortOrder: 60,
    sourceKind: "collection",
    title: "Editor's Picks",
    type: "collection",
  },
  {
    collectionSlug: "under-100000",
    desktopConfig: { itemLimit: 12 },
    slug: "under-100000-rail",
    sortOrder: 70,
    sourceKind: "collection",
    title: "Under ₦100,000",
    type: "product_rail",
  },
  {
    desktopConfig: { columns: 4, itemLimit: 12 },
    slug: "more-for-you",
    sortOrder: 80,
    sourceKind: "recommended",
    title: "More for you",
    type: "product_grid",
  },
  {
    desktopConfig: { itemLimit: 12 },
    slug: "popular-brands",
    sortOrder: 90,
    sourceKind: "manual",
    title: "Popular brands",
    type: "brand_rail",
  },
];

const EDITORS_PICKS_SIZE = 8;

async function seedCollectionRows(db: Client) {
  await db
    .insert(collections)
    .values(
      seedCollections.map((collection) => ({
        ...collection,
        status: "active" as const,
      })),
    )
    .onConflictDoNothing({ target: collections.slug });

  const rows = await db
    .select({ id: collections.id, slug: collections.slug })
    .from(collections);

  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function seedCampaignRows(db: Client) {
  await db
    .insert(campaigns)
    .values(
      seedCampaigns.map((campaign) => ({ ...campaign, status: "active" as const })),
    )
    .onConflictDoNothing({ target: campaigns.slug });

  const rows = await db
    .select({ id: campaigns.id, slug: campaigns.slug })
    .from(campaigns);

  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function seedEditorsPicks(db: Client, collectionId: string) {
  const picks = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.popularity))
    .limit(EDITORS_PICKS_SIZE);

  if (picks.length === 0) {
    return 0;
  }

  await db
    .insert(collectionProducts)
    .values(
      picks.map((product, index) => ({
        collectionId,
        productId: product.id,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing();

  return picks.length;
}

async function seedSectionRows(
  db: Client,
  campaignIds: Map<string, string>,
  collectionIds: Map<string, string>,
) {
  const rows = seedSections.map((section) => ({
    campaignId: section.campaignSlug
      ? (campaignIds.get(section.campaignSlug) ?? null)
      : null,
    collectionId: section.collectionSlug
      ? (collectionIds.get(section.collectionSlug) ?? null)
      : null,
    desktopConfig: section.desktopConfig ?? {},
    isActive: true,
    mobileConfig: {},
    slug: section.slug,
    sortOrder: section.sortOrder,
    sourceKind: section.sourceKind,
    sourceRef: section.sourceRef ?? null,
    title: section.title,
    type: section.type,
    viewMoreHref: section.viewMoreHref ?? null,
  }));

  await db
    .insert(storefrontSections)
    .values(rows)
    .onConflictDoNothing({ target: storefrontSections.slug });

  const stored = await db
    .select({ slug: storefrontSections.slug })
    .from(storefrontSections)
    .where(
      inArray(
        storefrontSections.slug,
        seedSections.map((section) => section.slug),
      ),
    );

  return stored.length;
}

export async function seedMerchandising() {
  const db = createClient();

  const collectionIds = await seedCollectionRows(db);
  const campaignIds = await seedCampaignRows(db);

  const editorsPicksId = collectionIds.get("editors-picks");
  const editorsPicks = editorsPicksId ? await seedEditorsPicks(db, editorsPicksId) : 0;

  const sections = await seedSectionRows(db, campaignIds, collectionIds);

  return {
    campaigns: campaignIds.size,
    collections: collectionIds.size,
    editorsPicksProducts: editorsPicks,
    sections,
  };
}
