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
