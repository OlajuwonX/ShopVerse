import { describe, expect, it } from "vitest";

import { permissions, type Permission } from "@/constants/permissions";
import {
  assertCanGrantPermissions,
  canGrantPermissions,
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
  isPermissionCode,
  PermissionDeniedError,
} from "@/server/auth/permissions";

function actorWith(granted: readonly Permission[]) {
  return { permissions: new Set(granted) };
}

describe("isPermissionCode", () => {
  it("accepts known codes and rejects anything else", () => {
    expect(isPermissionCode("products.read")).toBe(true);
    expect(isPermissionCode("products.destroy")).toBe(false);
    expect(isPermissionCode("")).toBe(false);
    expect(isPermissionCode("__proto__")).toBe(false);
  });

  it("covers every declared permission", () => {
    for (const permission of permissions) {
      expect(isPermissionCode(permission)).toBe(true);
    }
  });
});

describe("permission checks", () => {
  it("denies everything for a null or undefined actor", () => {
    expect(hasPermission(null, "products.read")).toBe(false);
    expect(hasPermission(undefined, "products.read")).toBe(false);
    expect(hasAnyPermission(null, ["products.read"])).toBe(false);
    expect(hasEveryPermission(null, ["products.read"])).toBe(false);
  });

  it("denies a permission the actor does not hold", () => {
    const actor = actorWith(["products.read"]);

    expect(hasPermission(actor, "products.read")).toBe(true);
    expect(hasPermission(actor, "products.update")).toBe(false);
  });

  it("requires all permissions for hasEveryPermission", () => {
    const actor = actorWith(["products.read", "products.update"]);

    expect(hasEveryPermission(actor, ["products.read", "products.update"])).toBe(true);
    expect(hasEveryPermission(actor, ["products.read", "products.archive"])).toBe(
      false,
    );
  });

  it("requires only one permission for hasAnyPermission", () => {
    const actor = actorWith(["orders.read"]);

    expect(hasAnyPermission(actor, ["orders.read", "payments.read"])).toBe(true);
    expect(hasAnyPermission(actor, ["payments.read", "staff.read"])).toBe(false);
  });

  it("treats an empty requirement list as satisfied for every, unsatisfied for any", () => {
    const actor = actorWith([]);

    expect(hasEveryPermission(actor, [])).toBe(true);
    expect(hasAnyPermission(actor, [])).toBe(false);
  });
});

describe("privilege escalation guard (SEC-15)", () => {
  it("blocks granting a permission the actor does not hold", () => {
    const actor = actorWith(["staff.invite", "roles.read"]);

    expect(canGrantPermissions(actor, ["staff.invite"])).toBe(true);
    expect(canGrantPermissions(actor, ["roles.update"])).toBe(false);
  });

  it("blocks a partial grant where one permission is missing", () => {
    const actor = actorWith(["products.read"]);

    expect(canGrantPermissions(actor, ["products.read", "payments.reconcile"])).toBe(
      false,
    );
  });

  it("throws a not-found-shaped error rather than leaking the reason", () => {
    const actor = actorWith(["products.read"]);

    expect(() => {
      assertCanGrantPermissions(actor, ["roles.update"]);
    }).toThrow(PermissionDeniedError);

    try {
      assertCanGrantPermissions(actor, ["roles.update"]);
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).status).toBe(404);
      expect((error as PermissionDeniedError).message).toBe("Not found");
    }
  });

  it("never lets an actor with no permissions grant anything", () => {
    expect(canGrantPermissions(actorWith([]), ["products.read"])).toBe(false);
    expect(canGrantPermissions(null, ["products.read"])).toBe(false);
  });
});
