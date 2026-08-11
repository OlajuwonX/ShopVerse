import "server-only";

import { and, asc, eq, lt } from "drizzle-orm";

import { db } from "@/server/db";
import { mediaCleanupQueue } from "@/server/db/schema";
import { destroyImage } from "@/server/media/cloudinary";

type CleanupReason = "orphaned_upload" | "detached_asset" | "rejected_upload";

const MAX_CLEANUP_ATTEMPTS = 5;

export async function enqueueMediaCleanup(
  cloudinaryPublicId: string,
  reason: CleanupReason,
) {
  await db.insert(mediaCleanupQueue).values({ cloudinaryPublicId, reason });
}

export async function processMediaCleanupQueue(limit = 25) {
  const pending = await db
    .select({
      attempts: mediaCleanupQueue.attempts,
      cloudinaryPublicId: mediaCleanupQueue.cloudinaryPublicId,
      id: mediaCleanupQueue.id,
    })
    .from(mediaCleanupQueue)
    .where(
      and(
        eq(mediaCleanupQueue.status, "pending"),
        lt(mediaCleanupQueue.attempts, MAX_CLEANUP_ATTEMPTS),
      ),
    )
    .orderBy(asc(mediaCleanupQueue.createdAt))
    .limit(limit);

  let resolved = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await destroyImage(entry.cloudinaryPublicId);

      await db
        .update(mediaCleanupQueue)
        .set({
          attempts: entry.attempts + 1,
          resolvedAt: new Date(),
          status: "resolved",
        })
        .where(eq(mediaCleanupQueue.id, entry.id));

      resolved += 1;
    } catch (error) {
      const attempts = entry.attempts + 1;

      await db
        .update(mediaCleanupQueue)
        .set({
          attempts,
          lastError: error instanceof Error ? error.message : "unknown",
          status: attempts >= MAX_CLEANUP_ATTEMPTS ? "failed" : "pending",
        })
        .where(eq(mediaCleanupQueue.id, entry.id));

      failed += 1;
    }
  }

  return { failed, resolved, scanned: pending.length };
}
