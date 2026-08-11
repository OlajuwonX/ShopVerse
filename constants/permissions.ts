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

export const roleDefinitions: Record<RoleCode, { description: string; name: string }> =
  {
    SUPER_ADMIN: {
      name: "Super Admin",
      description: "Full access to every backoffice capability.",
    },
    STORE_MANAGER: {
      name: "Store Manager",
      description: "Runs day-to-day commerce operations without staff administration.",
    },
    MERCHANDISER: {
      name: "Merchandiser",
      description:
        "Manages catalogue presentation, collections and storefront sections.",
    },
    ORDER_MANAGER: {
      name: "Order Manager",
      description: "Processes orders, refunds and customer delivery operations.",
    },
    INVENTORY_MANAGER: {
      name: "Inventory Manager",
      description: "Maintains stock levels and inventory accuracy.",
    },
    CUSTOMER_SUPPORT: {
      name: "Customer Support",
      description: "Read-only access for answering customer questions.",
    },
    CUSTOM: {
      name: "Custom",
      description: "No baseline permissions; access is granted per staff member.",
    },
  };

export const roleDefaultPermissions: Record<RoleCode, readonly Permission[]> = {
  SUPER_ADMIN: permissions,
  STORE_MANAGER: [
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
    "payments.read",
    "customers.read",
    "analytics.read",
    "storefront.read",
    "storefront.update",
    "activity.read",
    "settings.read",
  ],
  MERCHANDISER: [
    "products.read",
    "products.create",
    "products.update",
    "categories.read",
    "categories.create",
    "categories.update",
    "inventory.read",
    "storefront.read",
    "storefront.update",
    "analytics.read",
  ],
  ORDER_MANAGER: [
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",
    "payments.read",
    "customers.read",
    "products.read",
    "inventory.read",
    "analytics.read",
  ],
  INVENTORY_MANAGER: [
    "inventory.read",
    "inventory.update",
    "products.read",
    "categories.read",
    "orders.read",
    "analytics.read",
  ],
  CUSTOMER_SUPPORT: ["orders.read", "customers.read", "products.read", "payments.read"],
  CUSTOM: [],
};
