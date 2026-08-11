import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { id } from "@/server/db/schema/shared";

export const mediaCleanupReason = pgEnum("media_cleanup_reason", [
  "orphaned_upload",

  "detached_asset",

  "rejected_upload",
]);

export const mediaCleanupStatus = pgEnum("media_cleanup_status", [
  "pending",
  "resolved",
  "failed",
]);

export const mediaCleanupQueue = pgTable(
  "media_cleanup_queue",
  {
    id,
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    reason: mediaCleanupReason("reason").notNull(),
    status: mediaCleanupStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("media_cleanup_queue_status_created_idx").on(table.status, table.createdAt),
    index("media_cleanup_queue_public_id_idx").on(table.cloudinaryPublicId),
    check("media_cleanup_queue_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check(
      "media_cleanup_queue_resolved_at_matches_status",
      sql`(${table.status} = 'resolved' and ${table.resolvedAt} is not null) or (${table.status} <> 'resolved' and ${table.resolvedAt} is null)`,
    ),
  ],
);
