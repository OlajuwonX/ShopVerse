/**
 * Idempotent RBAC seed.
 *
 * Runs outside the Next.js runtime (`pnpm db:seed`), so it deliberately avoids
 * every module that imports `server-only` and builds its own connection from
 * `DATABASE_URL`. Re-running it is safe: permissions and roles are upserted by
 * their unique codes and grants are inserted with conflict-do-nothing.
 */
import { neon } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";

import { BCRYPT_COST } from "@/constants/auth";
import {
  permissions,
  roleCodes,
  roleDefaultPermissions,
  roleDefinitions,
} from "@/constants/permissions";
import * as schema from "@/server/db/schema";

const { permissionsTable, rolePermissions, roles, staffAccounts, users } = schema;

function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function createClient() {
  return drizzle(neon(requireEnv("DATABASE_URL")), { schema });
}

type Client = ReturnType<typeof createClient>;

async function seedPermissions(db: Client) {
  await db
    .insert(permissionsTable)
    .values(permissions.map((code) => ({ code })))
    .onConflictDoNothing({ target: permissionsTable.code });

  const rows = await db
    .select({ code: permissionsTable.code, id: permissionsTable.id })
    .from(permissionsTable);

  return new Map(rows.map((row) => [row.code, row.id]));
}

async function seedRoles(db: Client) {
  await db
    .insert(roles)
    .values(
      roleCodes.map((code) => ({
        code,
        description: roleDefinitions[code].description,
        isSystem: true,
        name: roleDefinitions[code].name,
      })),
    )
    .onConflictDoNothing({ target: roles.code });

  const rows = await db.select({ code: roles.code, id: roles.id }).from(roles);

  return new Map(rows.map((row) => [row.code, row.id]));
}

async function seedRoleGrants(
  db: Client,
  roleIds: Map<string, string>,
  permissionIds: Map<string, string>,
) {
  const grants: { permissionId: string; roleId: string }[] = [];

  for (const code of roleCodes) {
    const roleId = roleIds.get(code);

    if (!roleId) {
      throw new Error(`Role was not seeded: ${code}`);
    }

    for (const permission of roleDefaultPermissions[code]) {
      const permissionId = permissionIds.get(permission);

      if (!permissionId) {
        throw new Error(`Permission was not seeded: ${permission}`);
      }

      grants.push({ permissionId, roleId });
    }
  }

  if (grants.length === 0) {
    return 0;
  }

  await db.insert(rolePermissions).values(grants).onConflictDoNothing();

  return grants.length;
}

/**
 * Creates the first SUPER_ADMIN so the backoffice is reachable at all. Skipped
 * unless both variables are present, and never overwrites an existing account —
 * password rotation is an explicit admin operation, not a seed side effect.
 */
async function bootstrapSuperAdmin(db: Client, roleIds: Map<string, string>) {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    return "skipped";
  }

  if (password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters");
  }

  const roleId = roleIds.get("SUPER_ADMIN");

  if (!roleId) {
    throw new Error("SUPER_ADMIN role was not seeded");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    return "exists";
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const insertedUser = await db
    .insert(users)
    .values({
      email,
      emailVerifiedAt: new Date(),
      name: "Super Admin",
      passwordHash,
      passwordChangedAt: new Date(),
      status: "active",
    })
    .returning({ id: users.id });

  const userId = insertedUser[0]?.id;

  if (!userId) {
    throw new Error("Unable to create the bootstrap super admin user");
  }

  await db.insert(staffAccounts).values({
    roleId,
    status: "active",
    title: "Super Admin",
    userId,
  });

  return "created";
}

async function reportUnknownPermissions(db: Client) {
  const known = new Set<string>(permissions);
  const rows = await db
    .select({ code: permissionsTable.code })
    .from(permissionsTable)
    .where(inArray(permissionsTable.code, [...known]));

  return known.size - rows.length;
}

export async function seedRbac() {
  const db = createClient();

  const permissionIds = await seedPermissions(db);
  const roleIds = await seedRoles(db);
  const grantCount = await seedRoleGrants(db, roleIds, permissionIds);
  const superAdmin = await bootstrapSuperAdmin(db, roleIds);
  const missing = await reportUnknownPermissions(db);

  return {
    grants: grantCount,
    missingPermissions: missing,
    permissions: permissionIds.size,
    roles: roleIds.size,
    superAdmin,
  };
}
