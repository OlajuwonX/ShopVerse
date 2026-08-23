import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "@/server/db/schema/auth";
import { products } from "@/server/db/schema/catalogue";
import { id } from "@/server/db/schema/shared";

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wishlist_items_user_product_unique").on(table.userId, table.productId),
    index("wishlist_items_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
);
