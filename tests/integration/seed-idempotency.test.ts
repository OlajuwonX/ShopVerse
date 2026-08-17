import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hasRealDatabase } from "@/tests/setup/env";
import { db } from "@/server/db";
import { seedCatalogue } from "@/server/db/seed/catalogue";
import { seedMerchandising } from "@/server/db/seed/merchandising";

async function counts() {
  const rows = await db.execute<{
    collection_products: number;
    products: number;
    distinct_names: number;
    sections: number;
    variants: number;
  }>(sql`
    select
      (select count(*)::int from products) as products,
      (select count(distinct name)::int from products) as distinct_names,
      (select count(*)::int from product_variants) as variants,
      (select count(*)::int from storefront_sections) as sections,
      (select count(*)::int from collection_products) as collection_products
  `);

  return rows.rows[0];
}

const SEED_TIMEOUT_MS = 240_000;

describe.skipIf(!hasRealDatabase)("seed idempotency (DATA-07)", () => {
  it(
    "does not duplicate the catalogue when the seeder runs again",
    async () => {
      const before = await counts();

      expect(before?.products).toBeGreaterThan(0);

      await seedCatalogue();

      const after = await counts();

      expect(after?.products).toBe(before?.products);
      expect(after?.variants).toBe(before?.variants);
    },
    SEED_TIMEOUT_MS,
  );

  it("keeps one product row per distinct product name", async () => {
    const current = await counts();

    expect(current?.products).toBe(current?.distinct_names);
  });

  it(
    "does not duplicate merchandising when the seeder runs again",
    async () => {
      const before = await counts();

      await seedMerchandising();

      const after = await counts();

      expect(after?.sections).toBe(before?.sections);
      expect(after?.collection_products).toBe(before?.collection_products);
    },
    SEED_TIMEOUT_MS,
  );

  it("leaves no slug suffixed beyond what the seed set itself requires", async () => {
    const rows = await db.execute<{ slug: string }>(sql`
      select p.slug
      from products p
      where p.slug ~ '-[0-9]+$'
        and exists (
          select 1 from products base
          where base.slug = regexp_replace(p.slug, '-[0-9]+$', '')
            and base.name = p.name
        )
    `);

    expect(rows.rows.map((row) => row.slug)).toStrictEqual([]);
  });
});
