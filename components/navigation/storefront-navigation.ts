export type StorefrontNavItem = {
  available: boolean;
  href: string;
  label: string;
};

export const discoveryNavItems: readonly StorefrontNavItem[] = [
  { available: false, href: "/trending", label: "Trending" },
  { available: false, href: "/offers", label: "Offers" },
  { available: false, href: "/new-arrivals", label: "New Arrivals" },
  { available: false, href: "/best-sellers", label: "Best Sellers" },
];

export const accountNavItems: readonly StorefrontNavItem[] = [
  { available: false, href: "/account", label: "Account" },
  { available: false, href: "/account/orders", label: "Orders" },
  { available: false, href: "/track", label: "Track order" },
];

export const supportNavItems: readonly StorefrontNavItem[] = [
  { available: false, href: "/help", label: "Help" },
  { available: false, href: "/delivery", label: "Delivery" },
  { available: false, href: "/returns", label: "Returns" },
  { available: false, href: "/support", label: "Contact support" },
];
