import type { Metadata } from "next";

import { CartContents } from "@/components/commerce/CartContents";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "Cart",
};

export default function CartPage() {
  return (
    <div className="w-full py-6">
      <Breadcrumb
        className="mb-4"
        items={[{ href: "/", label: "Home" }, { label: "Cart" }]}
      />

      <header className="mb-4 grid gap-1">
        <h1 className="text-heading-2 font-bold text-text">Your cart</h1>
        <p className="text-body-sm text-text-muted">
          Items are kept on this device. Prices, discounts and stock are confirmed by
          the server every time this page loads.
        </p>
      </header>

      <CartContents />
    </div>
  );
}
