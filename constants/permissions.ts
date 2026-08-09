export const permissions = [
  "products.read",
  "products.create",
  "products.update",
  "products.archive",
  "categories.read",
  "categories.create",
  "categories.update",
  "inventory.read",
  "inventory.update",
  "orders.read",
  "orders.update",
  "orders.cancel",
  "orders.refund",
  "payments.read",
  "payments.reconcile",
  "customers.read",
  "analytics.read",
  "storefront.read",
  "storefront.update",
  "activity.read",
  "staff.read",
  "staff.invite",
  "staff.update",
  "staff.remove",
  "roles.read",
  "roles.update",
  "settings.read",
  "settings.update",
] as const;

export type Permission = (typeof permissions)[number];

export const roleCodes = [
  "SUPER_ADMIN",
  "STORE_MANAGER",
  "MERCHANDISER",
  "ORDER_MANAGER",
  "INVENTORY_MANAGER",
  "CUSTOMER_SUPPORT",
  "CUSTOM",
] as const;

export type RoleCode = (typeof roleCodes)[number];
