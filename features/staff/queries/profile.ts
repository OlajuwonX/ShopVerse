import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { roles, staffAccounts, users } from "@/server/db/schema";

export type StaffProfile = {
  email: string;
  name: string | null;
  roleCode: string;
  roleName: string;
  title: string | null;
};

/**
 * Loads the display identity for the signed-in staff member. Scoped by the
 * server-resolved `staffAccountId` — never by a client-supplied id.
 */
export async function getStaffProfile(
  staffAccountId: string,
): Promise<StaffProfile | null> {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      roleCode: roles.code,
      roleName: roles.name,
      title: staffAccounts.title,
    })
    .from(staffAccounts)
    .innerJoin(users, eq(staffAccounts.userId, users.id))
    .innerJoin(roles, eq(staffAccounts.roleId, roles.id))
    .where(eq(staffAccounts.id, staffAccountId))
    .limit(1);

  return rows[0] ?? null;
}
