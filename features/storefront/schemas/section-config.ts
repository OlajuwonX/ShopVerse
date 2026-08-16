import { z } from "zod";

import { catalogueSortOptions } from "@/features/products/schemas/catalogue-query";

export const SECTION_MAX_ITEMS = 24;
export const SECTION_DEFAULT_ITEMS = 12;

export const sectionLayoutConfigSchema = z
  .object({
    columns: z.number().int().min(1).max(6).optional(),
    itemLimit: z.number().int().min(1).max(SECTION_MAX_ITEMS).optional(),
  })
  .catch({});

export type SectionLayoutConfig = z.infer<typeof sectionLayoutConfigSchema>;

export const collectionRulesSchema = z
  .object({
    categorySlug: z.string().min(1).max(96).optional(),
    inStockOnly: z.boolean().optional(),
    maxPrice: z.number().int().nonnegative().optional(),
    minPrice: z.number().int().nonnegative().optional(),
    minRating: z.number().int().min(0).max(5).optional(),
    onSaleOnly: z.boolean().optional(),
    sort: z.enum(catalogueSortOptions).optional(),
  })
  .catch({});

export type CollectionRules = z.infer<typeof collectionRulesSchema>;

export const campaignContentSchema = z
  .object({
    body: z.string().max(240).optional(),
    ctaLabel: z.string().max(40).optional(),
    eyebrow: z.string().max(40).optional(),
    secondaryBody: z.string().max(240).optional(),
    secondaryCtaHref: z.string().max(512).optional(),
    secondaryCtaLabel: z.string().max(40).optional(),
  })
  .catch({});

export type CampaignContent = z.infer<typeof campaignContentSchema>;
