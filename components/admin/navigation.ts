import {
  Boxes,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/constants/permissions";

export type AdminNavItem = {
  available: boolean;
  icon: LucideIcon;
  label: string;

  segments: readonly string[];

  permissions: readonly Permission[];
};

export type AdminNavGroup = {
  items: readonly AdminNavItem[];
  label: string;
};

export const adminNavGroups: readonly AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        available: true,
        icon: LayoutDashboard,
        label: "Dashboard",
        permissions: [],
        segments: [],
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        available: false,
        icon: Package,
        label: "Products",
        permissions: ["products.read"],
        segments: ["products"],
      },
      {
        available: false,
        icon: Tags,
        label: "Categories",
        permissions: ["categories.read"],
        segments: ["categories"],
      },
      {
        available: false,
        icon: Boxes,
        label: "Inventory",
        permissions: ["inventory.read"],
        segments: ["inventory"],
      },
      {
        available: false,
        icon: LayoutTemplate,
        label: "Storefront",
        permissions: ["storefront.read"],
        segments: ["storefront"],
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      {
        available: false,
        icon: ShoppingBag,
        label: "Orders",
        permissions: ["orders.read"],
        segments: ["orders"],
      },
      {
        available: false,
        icon: CreditCard,
        label: "Payments",
        permissions: ["payments.read"],
        segments: ["payments"],
      },
      {
        available: false,
        icon: Users,
        label: "Customers",
        permissions: ["customers.read"],
        segments: ["customers"],
      },
      {
        available: false,
        icon: ClipboardList,
        label: "Analytics",
        permissions: ["analytics.read"],
        segments: ["analytics"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        available: false,
        icon: UserCog,
        label: "Staff",
        permissions: ["staff.read", "roles.read"],
        segments: ["staff"],
      },
      {
        available: false,
        icon: ScrollText,
        label: "Activity",
        permissions: ["activity.read"],
        segments: ["activity"],
      },
      {
        available: false,
        icon: Settings,
        label: "Settings",
        permissions: ["settings.read"],
        segments: ["settings"],
      },
    ],
  },
];
