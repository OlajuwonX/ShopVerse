import type { ReactNode } from "react";

import type { Permission } from "@/constants/permissions";
import type { StaffActor } from "@/server/auth/permissions";

type PermissionGuardProps = {
  actor: Pick<StaffActor, "permissions"> | null | undefined;
  children: ReactNode;
  fallback?: ReactNode;

  permissions: readonly Permission[];
};

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
