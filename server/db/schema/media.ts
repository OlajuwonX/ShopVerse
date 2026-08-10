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
  // Uploaded to Cloudinary, but the database row could not be written (MEDIA-03).
  "orphaned_upload",
  // Database row removed; the Cloudinary asset still needs deleting (MEDIA-04).
  "detached_asset",
  // Upload rejected after Cloudinary reported its dimensions.
  "rejected_upload",
]);

export const mediaCleanupStatus = pgEnum("media_cleanup_status", [
  "pending",
  "resolved",
  "failed",
]);

/**
 * Durable record of Cloudinary assets that must be deleted.
 *
 * Cloudinary and Neon cannot be written atomically, so every path that leaves
 * an asset without an owning row enqueues it here rather than attempting a
 * best-effort delete that could be lost to a crash (MEDIA-03, MEDIA-04).
 */
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
