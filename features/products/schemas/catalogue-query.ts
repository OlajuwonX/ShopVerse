import { z } from "zod";

/**
 * Every catalogue list query is bounded (MASTER §61 — all list queries require
 * pagination). The page size is capped server-side so a crafted URL cannot ask
 * for the whole table.
 */
export const CATALOGUE_PAGE_SIZE = 24;
export const CATALOGUE_MAX_PAGE_SIZE = 48;

export const catalogueSortOptions = [
  "newest",
  "price_asc",
  "price_desc",
  "popularity",
  "rating",
] as const;

export type CatalogueSort = (typeof catalogueSortOptions)[number];

/**
 * Opaque cursor. It encodes the sort key plus the row id as a tiebreaker, so
 * pagination is stable when many rows share a price or timestamp — and it never
 * exposes an offset a client could inflate.
 */
export const catalogueCursorSchema = z.object({
  id: z.string().uuid(),
  value: z.union([z.number().int(), z.string()]),
});

export type CatalogueCursor = z.infer<typeof catalogueCursorSchema>;

export function encodeCursor(cursor: CatalogueCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/**
 * A malformed or tampered cursor yields `null` — the caller starts from the
 * first page rather than throwing or scanning the table (`SRCH-08`).
 */
export function decodeCursor(raw: string | null | undefined): CatalogueCursor | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const result = catalogueCursorSchema.safeParse(parsed);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Prices arrive as major units in URLs and are converted to kobo server-side. */
export const catalogueQuerySchema = z.object({
  brandSlugs: z.array(z.string().min(1).max(96)).max(20).optional(),
  categorySlug: z.string().min(1).max(96).optional(),
  cursor: z.string().max(512).nullish(),
  inStockOnly: z.boolean().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(CATALOGUE_MAX_PAGE_SIZE)
    .default(CATALOGUE_PAGE_SIZE),
  maxPrice: z.number().int().nonnegative().optional(),
  minPrice: z.number().int().nonnegative().optional(),
  minRating: z.number().int().min(0).max(5).optional(),
  onSaleOnly: z.boolean().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(catalogueSortOptions).default("newest"),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
