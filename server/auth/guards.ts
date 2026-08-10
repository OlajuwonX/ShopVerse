import "server-only";

import { notFound } from "next/navigation";

import type { Permission } from "@/constants/permissions";
import {
  PermissionDeniedError,
  requireAnyPermission,
  requirePermission,
  requireStaffActor,
  type StaffActor,
} from "@/server/auth/permissions";

/**
 * Route-level wrappers around the RBAC service.
 *
 * `requirePermission` throws a domain error, which is the right shape for
 * server actions and route handlers that must return a response. Pages instead
 * need the denial to be *indistinguishable from a missing page* (SEC-17,
 * MASTER §39), so these helpers convert it into a real 404 rather than letting
 * an error boundary advertise that something exists here but was refused.
 *
 * Unexpected errors are re-thrown untouched.
 */
async function toNotFound<T>(resolve: () => Promise<T>): Promise<T> {
  try {
    return await resolve();
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      notFound();
    }

    throw error;
  }
}

export function guardStaffActor(): Promise<StaffActor> {
  return toNotFound(requireStaffActor);
}

export function guardPermission(permission: Permission): Promise<StaffActor> {
  return toNotFound(() => requirePermission(permission));
}

export function guardAnyPermission(
  permissionsToCheck: readonly Permission[],
): Promise<StaffActor> {
  return toNotFound(() => requireAnyPermission(permissionsToCheck));
}
