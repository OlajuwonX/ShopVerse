import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "@/server/db/schema/shared";

export const userStatus = pgEnum("user_status", ["active", "disabled", "deleted"]);
export const staffStatus = pgEnum("staff_status", [
  "invited",
  "active",
  "disabled",
  "removed",
]);
export const sessionAudience = pgEnum("session_audience", ["customer", "staff"]);
export const staffInvitationStatus = pgEnum("staff_invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);
export const authTokenPurpose = pgEnum("auth_token_purpose", [
  "email_verification",
  "password_reset",
  "post_purchase_signup",
]);
export const permissionOverrideEffect = pgEnum("permission_override_effect", [
  "allow",
  "deny",
]);

export const users = pgTable(
  "users",
  {
    id,
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
    name: text("name"),
    passwordHash: text("password_hash"),
    status: userStatus("status").notNull().default("active"),
    passwordChangedAt: timestamp("password_changed_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastLoginAt: timestamp("last_login_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_status_idx").on(table.status),
  ],
);

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    phone: text("phone"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("customer_profiles_user_unique").on(table.userId)],
);

export const roles = pgTable(
  "roles",
  {
    id,
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("roles_code_unique").on(table.code)],
);

export const permissionsTable = pgTable(
  "permissions",
  {
    id,
    code: text("code").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [uniqueIndex("permissions_code_unique").on(table.code)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissionsTable.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("role_permissions_unique").on(table.roleId, table.permissionId),
    index("role_permissions_permission_idx").on(table.permissionId),
  ],
);

export const staffAccounts = pgTable(
  "staff_accounts",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: staffStatus("status").notNull().default("invited"),
    title: text("title"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretEncrypted: text("mfa_secret_encrypted"),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }),
    disabledAt: timestamp("disabled_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("staff_accounts_user_unique").on(table.userId),
    index("staff_accounts_role_status_idx").on(table.roleId, table.status),
    index("staff_accounts_status_idx").on(table.status),
    check(
      "staff_accounts_mfa_secret_when_enabled",
      sql`(${table.mfaEnabled} = false and ${table.mfaSecretEncrypted} is null) or (${table.mfaEnabled} = true and ${table.mfaSecretEncrypted} is not null)`,
    ),
  ],
);

export const staffPermissionOverrides = pgTable(
  "staff_permission_overrides",
  {
    staffAccountId: uuid("staff_account_id")
      .notNull()
      .references(() => staffAccounts.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissionsTable.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    effect: permissionOverrideEffect("effect").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_permission_overrides_unique").on(
      table.staffAccountId,
      table.permissionId,
    ),
    index("staff_permission_overrides_permission_idx").on(table.permissionId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id,
    sessionTokenHash: text("session_token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    staffAccountId: uuid("staff_account_id").references(() => staffAccounts.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    audience: sessionAudience("audience").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.sessionTokenHash),
    index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
    index("sessions_staff_expires_idx").on(table.staffAccountId, table.expiresAt),
    check(
      "sessions_staff_audience_requires_staff_account",
      sql`(${table.audience} = 'staff' and ${table.staffAccountId} is not null) or (${table.audience} = 'customer' and ${table.staffAccountId} is null)`,
    ),
    check("sessions_expiry_valid", sql`${table.createdAt} < ${table.expiresAt}`),
  ],
);

export const staffInvitations = pgTable(
  "staff_invitations",
  {
    id,
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    invitedByStaffId: uuid("invited_by_staff_id")
      .notNull()
      .references(() => staffAccounts.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    tokenHash: text("token_hash").notNull(),
    status: staffInvitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("staff_invitations_token_hash_unique").on(table.tokenHash),
    index("staff_invitations_email_status_idx").on(table.email, table.status),
    index("staff_invitations_status_expires_idx").on(table.status, table.expiresAt),
    check(
      "staff_invitations_expiry_valid",
      sql`${table.createdAt} < ${table.expiresAt}`,
    ),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    purpose: authTokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
    invalidatedAt: timestamp("invalidated_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_tokens_token_hash_unique").on(table.tokenHash),
    index("auth_tokens_user_purpose_idx").on(table.userId, table.purpose),
    index("auth_tokens_purpose_expires_idx").on(table.purpose, table.expiresAt),
    check("auth_tokens_expiry_valid", sql`${table.createdAt} < ${table.expiresAt}`),
  ],
);
