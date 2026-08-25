import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { cartHref } from "@/lib/routes";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <div className="w-full py-6">
      <Breadcrumb
        className="mb-4"
        items={[
          { href: "/", label: "Home" },
          { href: cartHref(), label: "Cart" },
          { label: "Checkout" },
        ]}
      />

      <header className="mb-6 grid gap-1">
        <h1 className="text-heading-2 font-bold text-text">Checkout</h1>
        <p className="text-body-sm text-text-muted">
          No account needed. Enter where the order should go and we will price delivery
          from your state.
        </p>
      </header>

      <CheckoutForm />
    </div>
  );
}
