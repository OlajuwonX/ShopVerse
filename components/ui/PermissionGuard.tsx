import type { ReactNode } from "react";

import type { Permission } from "@/constants/permissions";
import type { StaffActor } from "@/server/auth/permissions";

type PermissionGuardProps = {
  actor: Pick<StaffActor, "permissions"> | null | undefined;
  children: ReactNode;
  fallback?: ReactNode;
  /** Actor needs at least one of these. Empty means any active staff member. */
  permissions: readonly Permission[];
};

/**
 * Hides actions the actor cannot perform, purely to reduce confusion.
 *
 * This is never an enforcement point. Deleting every usage must not change what
 * any request is able to do — the server-side permission check on the action or
 * route is the only authority (primitives/09-rbac.md).
 */
export function PermissionGuard({
  actor,
  children,
  fallback = null,
  permissions,
}: PermissionGuardProps) {
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  const allowed = permissions.some(
    (permission) => actor?.permissions.has(permission) ?? false,
  );

  return <>{allowed ? children : fallback}</>;
}
