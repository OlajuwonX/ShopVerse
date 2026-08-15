import "server-only";

import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { permissions, type Permission } from "@/constants/permissions";
import { requireStaffSession } from "@/server/auth/sessions";
import type { AuthenticatedSession } from "@/server/auth/types";
import { db } from "@/server/db";
import {
  permissionsTable,
  rolePermissions,
  roles,
  staffAccounts,
  staffPermissionOverrides,
} from "@/server/db/schema";

const permissionCodes = new Set<string>(permissions);

export class PermissionDeniedError extends Error {
  readonly status = 404;

  constructor() {
    super("Not found");
    this.name = "PermissionDeniedError";
  }
}

export type StaffActor = AuthenticatedSession & {
  audience: "staff";
  permissions: ReadonlySet<Permission>;
  staffAccountId: string;
};

export function isPermissionCode(code: string): code is Permission {
  return permissionCodes.has(code);
}

function addKnownPermission(target: Set<Permission>, code: string) {
  if (isPermissionCode(code)) {
    target.add(code);
  }
}

function removeKnownPermission(target: Set<Permission>, code: string) {
  if (isPermissionCode(code)) {
    target.delete(code);
  }
}

export async function resolveStaffPermissions(staffAccountId: string) {
  const roleRows = await db
    .select({ code: permissionsTable.code })
    .from(staffAccounts)
    .innerJoin(roles, eq(staffAccounts.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissionsTable, eq(rolePermissions.permissionId, permissionsTable.id))
    .where(
      and(eq(staffAccounts.id, staffAccountId), eq(staffAccounts.status, "active")),
    );

  const resolved = new Set<Permission>();

  for (const row of roleRows) {
    addKnownPermission(resolved, row.code);
  }

  const overrideRows = await db
    .select({ code: permissionsTable.code, effect: staffPermissionOverrides.effect })
    .from(staffPermissionOverrides)
    .innerJoin(
      permissionsTable,
      eq(staffPermissionOverrides.permissionId, permissionsTable.id),
    )
    .where(eq(staffPermissionOverrides.staffAccountId, staffAccountId));

  for (const row of overrideRows) {
    if (row.effect === "allow") {
      addKnownPermission(resolved, row.code);
    } else {
      removeKnownPermission(resolved, row.code);
    }
  }

  return resolved;
}

export const getCurrentStaffActor = cache(async () => {
  const session = await requireStaffSession();

  if (!session?.staffAccountId) {
    return null;
  }

  const resolvedPermissions = await resolveStaffPermissions(session.staffAccountId);

  return {
    ...session,
    audience: "staff",
    permissions: resolvedPermissions,
    staffAccountId: session.staffAccountId,
  } satisfies StaffActor;
});

export function hasPermission(
  actor: Pick<StaffActor, "permissions"> | null | undefined,
  permission: Permission,
) {
  return actor?.permissions.has(permission) ?? false;
}

export function hasEveryPermission(
  actor: Pick<StaffActor, "permissions"> | null | undefined,
  permissionsToCheck: readonly Permission[],
) {
  return permissionsToCheck.every((permission) => hasPermission(actor, permission));
}

export function hasAnyPermission(
  actor: Pick<StaffActor, "permissions"> | null | undefined,
  permissionsToCheck: readonly Permission[],
) {
  return permissionsToCheck.some((permission) => hasPermission(actor, permission));
}

export async function requireStaffActor(): Promise<StaffActor> {
  const actor = await getCurrentStaffActor();

  if (!actor) {
    throw new PermissionDeniedError();
  }

  return actor;
}

export async function requirePermission(permission: Permission): Promise<StaffActor> {
  const actor = await requireStaffActor();

  if (!hasPermission(actor, permission)) {
    throw new PermissionDeniedError();
  }

  return actor;
}

export async function requireAnyPermission(
  permissionsToCheck: readonly Permission[],
): Promise<StaffActor> {
  const actor = await requireStaffActor();

  if (!hasAnyPermission(actor, permissionsToCheck)) {
    throw new PermissionDeniedError();
  }

  return actor;
}

export function canGrantPermissions(
  actor: Pick<StaffActor, "permissions"> | null | undefined,
  permissionsToGrant: readonly Permission[],
) {
  return hasEveryPermission(actor, permissionsToGrant);
}

export function assertCanGrantPermissions(
  actor: Pick<StaffActor, "permissions"> | null | undefined,
  permissionsToGrant: readonly Permission[],
) {
  if (!canGrantPermissions(actor, permissionsToGrant)) {
    throw new PermissionDeniedError();
  }
}
