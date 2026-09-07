import type { Metadata } from "next";

import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PAYMENT_REFERENCE_PATTERN } from "@/lib/order-reference";
import { cartHref } from "@/lib/routes";
import { findPaymentByReference } from "@/server/services/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Confirming your payment",
};

type CallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentCallbackPage({ searchParams }: CallbackPageProps) {
  const params = await searchParams;
  const reference =
    firstValue(params.reference) ?? firstValue(params.trxref) ?? undefined;

  const payment =
    reference && PAYMENT_REFERENCE_PATTERN.test(reference)
      ? await findPaymentByReference(reference)
      : null;

  return (
    <div className="w-full py-6">
      <Breadcrumb
        className="mb-4"
        items={[
          { href: "/", label: "Home" },
          { href: cartHref(), label: "Cart" },
          { label: "Payment" },
        ]}
      />

      <section aria-labelledby="payment-callback" className="grid max-w-2xl gap-3">
        <h1 className="text-heading-2 font-bold text-text" id="payment-callback">
          Confirming your payment
        </h1>

        {payment ? (
          <>
            <p className="text-body-sm text-text">
              Thanks — we have you back from Paystack. We are confirming the payment for
              order <strong className="font-semibold">{payment.orderReference}</strong>{" "}
              with your bank now.
            </p>
            <p className="text-body-sm text-text-muted">
              Returning to this page does not by itself mean the payment succeeded. We
              confirm every payment with Paystack directly before we treat an order as
              paid, so keep your reference and we will email you once it is settled.
            </p>
          </>
        ) : (
          <>
            <p className="text-body-sm text-text">
              We could not match that payment reference to an order.
            </p>
            <p className="text-body-sm text-text-muted">
              If money left your account, nothing is lost — quote your reference and we
              will trace it. Payments are always confirmed against Paystack, never from
              this page alone.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
