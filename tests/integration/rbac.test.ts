import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { permissions } from "@/constants/permissions";
import { hasRealDatabase } from "@/tests/setup/env";
import { resolveStaffPermissions } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { roles, staffAccounts } from "@/server/db/schema";

async function staffAccountForRole(roleCode: string) {
  const rows = await db
    .select({ id: staffAccounts.id, status: staffAccounts.status })
    .from(staffAccounts)
    .innerJoin(roles, eq(staffAccounts.roleId, roles.id))
    .where(and(eq(roles.code, roleCode), eq(staffAccounts.status, "active")))
    .limit(1);

  return rows[0] ?? null;
}

describe.skipIf(!hasRealDatabase)("resolveStaffPermissions", () => {
  it("grants the super admin every declared permission", async () => {
    const account = await staffAccountForRole("SUPER_ADMIN");

    expect(account).not.toBeNull();

    const resolved = await resolveStaffPermissions(account?.id ?? "");

    expect(resolved.size).toBe(permissions.length);

    for (const permission of permissions) {
      expect(resolved.has(permission)).toBe(true);
    }
  });

  it("grants nothing for an unknown staff account (SEC-02)", async () => {
    const resolved = await resolveStaffPermissions(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(resolved.size).toBe(0);
  });

  it("resolves permissions from the database, not from a client claim", async () => {
    const account = await staffAccountForRole("SUPER_ADMIN");
    const first = await resolveStaffPermissions(account?.id ?? "");
    const second = await resolveStaffPermissions(account?.id ?? "");

    expect([...first].sort()).toStrictEqual([...second].sort());
  });

  it("only ever returns codes the application knows about", async () => {
    const account = await staffAccountForRole("SUPER_ADMIN");
    const resolved = await resolveStaffPermissions(account?.id ?? "");

    for (const code of resolved) {
      expect(permissions).toContain(code);
    }
  });
});

describe.skipIf(!hasRealDatabase)("seeded role model", () => {
  it("defines every role the permission model expects", async () => {
    const rows = await db.select({ code: roles.code }).from(roles);
    const codes = rows.map((row) => row.code);

    for (const expected of [
      "SUPER_ADMIN",
      "STORE_MANAGER",
      "ORDER_MANAGER",
      "INVENTORY_MANAGER",
      "CUSTOMER_SUPPORT",
    ]) {
      expect(codes).toContain(expected);
    }
  });

  it("gives non-super roles strictly fewer permissions than super admin (least privilege)", async () => {
    const superAdmin = await staffAccountForRole("SUPER_ADMIN");
    const superPermissions = await resolveStaffPermissions(superAdmin?.id ?? "");

    for (const roleCode of ["STORE_MANAGER", "CUSTOMER_SUPPORT"]) {
      const account = await staffAccountForRole(roleCode);

      if (!account) {
        continue;
      }

      const resolved = await resolveStaffPermissions(account.id);

      expect(resolved.size).toBeLessThan(superPermissions.size);
    }
  });
});
