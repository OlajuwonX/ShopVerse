import "server-only";

import { db } from "@/server/db";
import { activityLogs } from "@/server/db/schema";
import { getRequestContext } from "@/server/security/request-context";

type ActorType = "staff" | "customer" | "system";

type AuditEventInput = {
  action: string;
  actorId?: string | null;
  actorType: ActorType;
  after?: unknown;
  before?: unknown;
  targetId?: string | null;
  targetType: string;
};

/**
 * Append-only audit trail (MASTER §49, primitives/30-audit-logging.md).
 *
 * Only correlation identifiers and explicit before/after payloads are stored.
 * Callers must never pass passwords, tokens, session ids or card data — the
 * `before`/`after` values are written verbatim.
 *
 * Auditing must never break the operation it records, so write failures are
 * swallowed after being reported to the server log.
 */
export async function writeAuditLog(event: AuditEventInput) {
  try {
    const context = await getRequestContext();

    await db.insert(activityLogs).values({
      action: event.action,
      actorId: event.actorType === "system" ? null : (event.actorId ?? null),
      actorType: event.actorType,
      after: event.after ?? null,
      before: event.before ?? null,
      ip: context.ip,
      requestId: context.requestId,
      targetId: event.targetId ?? null,
      targetType: event.targetType,
      userAgent: context.userAgent,
    });
  } catch (error) {
    console.error("audit_log_write_failed", {
      action: event.action,
      targetType: event.targetType,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
