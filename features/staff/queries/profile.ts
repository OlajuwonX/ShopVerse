import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/server/db";
import { roles, staffAccounts, users } from "@/server/db/schema";

export type StaffProfile = {
  email: string;
  name: string | null;
  roleCode: string;
  roleName: string;
  title: string | null;
};

export const getStaffProfile = cache(
  async (staffAccountId: string): Promise<StaffProfile | null> => {
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
  },
);
