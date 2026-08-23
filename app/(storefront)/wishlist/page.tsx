import type { Metadata } from "next";

import { WishlistContents } from "@/components/commerce/WishlistContents";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "Wishlist",
};

export default function WishlistPage() {
  return (
    <div className="w-full py-6">
      <Breadcrumb
        className="mb-4"
        items={[{ href: "/", label: "Home" }, { label: "Wishlist" }]}
      />

      <header className="mb-4 grid gap-1">
        <h1 className="text-heading-2 font-bold text-text">Saved products</h1>
        <p className="text-body-sm text-text-muted">
          Products you save are kept on this device. Prices and availability are read
          live from the catalogue.
        </p>
      </header>

      <WishlistContents />
    </div>
  );
}
