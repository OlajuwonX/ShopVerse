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
