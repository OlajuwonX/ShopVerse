"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";

import { CheckoutReview } from "@/components/checkout/CheckoutReview";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import {
  DeliveryFields,
  emptyDeliveryValues,
  type DeliveryValues,
} from "@/components/checkout/DeliveryFields";
import { Money } from "@/components/commerce/Money";
import { notify } from "@/components/feedback/toast";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  CHECKOUT_HONEYPOT_FIELD,
  CHECKOUT_RENDERED_AT_FIELD,
} from "@/constants/checkout";
import { RESERVATION_MINUTES } from "@/constants/orders";
import { toCartLineInputs } from "@/features/cart/schemas/cart";
import { useCartValidation } from "@/features/cart/useCartValidation";
import { useGuestCart } from "@/features/cart/useGuestCart";
import { submitCheckout } from "@/features/checkout/actions/checkout";
import {
  initialCheckoutState,
  type CheckoutField,
} from "@/features/checkout/schemas/checkout";
import { useCheckoutAttempt } from "@/features/checkout/useCheckoutAttempt";
import { cartHref } from "@/lib/routes";

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function CheckoutForm() {
  const { lines: stored } = useGuestCart();
  const [values, setValues] = useState<DeliveryValues>(emptyDeliveryValues);
  const attemptId = useCheckoutAttempt();
  const [renderedAt] = useState(() => Date.now());

  const setField = useCallback((field: CheckoutField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const { isError, isLoading, isRevalidating, lines, refetch, totals } =
    useCartValidation(stored, values.state === "" ? undefined : values.state);

  const [state, formAction, isActionPending] = useActionState(
    submitCheckout,
    initialCheckoutState,
  );

  const [isSubmitting, startSubmit] = useTransition();
  const isPending = isActionPending || isSubmitting;

  useEffect(() => {
    if (state.formError) {
      notify({
        title: state.formError,
        tone: state.status === "price_changed" ? "info" : "error",
      });
    }
  }, [state.formError, state.status]);

  useEffect(() => {
    if (state.status === "ordered" && state.order) {
      notify({
        description: `We are holding your items while payment opens. Keep your reference ${state.order.reference}.`,
        title: `Order ${state.order.reference} placed`,
        tone: "success",
      });
    }
  }, [state.order, state.status]);

  if (stored.length === 0) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/">
            Shop now
          </Link>
        }
        description="Add something to your cart before checking out."
        title="Your cart is empty"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        action={
          <Button
            onClick={() => {
              void refetch();
            }}
            variant="secondary"
          >
            Try again
          </Button>
        }
        description="Your items are still saved on this device. We could not reach the server to confirm prices and stock, so checkout is not safe to start."
        title="Could not check your cart"
      />
    );
  }

  if (isLoading || totals === null) {
    return (
      <>
        <p aria-live="polite" className="sr-only" role="status">
          Checking prices and stock
        </p>
        <CheckoutSkeleton />
      </>
    );
  }

  const blocked = lines.some((line) => !line.purchasable || line.priceChanged);

  if (blocked) {
    return (
      <ErrorState
        action={
          <Link className={buttonStyles({ variant: "secondary" })} href={cartHref()}>
            Back to cart
          </Link>
        }
        description="Something in your cart changed — a price, an option, or the stock available. Review the cart and come back."
        title="Your cart needs attention"
      />
    );
  }

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        startSubmit(() => {
          formAction(formData);
        });
      }}
    >
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor={CHECKOUT_HONEYPOT_FIELD}>Delivery reference</label>
        <input
          autoComplete="off"
          defaultValue=""
          id={CHECKOUT_HONEYPOT_FIELD}
          name={CHECKOUT_HONEYPOT_FIELD}
          tabIndex={-1}
          type="text"
        />
      </div>

      <input
        name={CHECKOUT_RENDERED_AT_FIELD}
        type="hidden"
        value={String(renderedAt)}
      />
      <input name="checkoutAttemptId" type="hidden" value={attemptId} />
      <input name="acknowledgedTotal" type="hidden" value={String(totals.total)} />
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(toCartLineInputs(stored))}
      />

      <div className="grid gap-8">
        <CheckoutReview lines={lines} />

        {state.formError ? (
          <p
            className="rounded-md bg-danger-soft p-3 text-body-sm font-medium text-danger"
            role="alert"
          >
            {state.formError}
          </p>
        ) : null}

        {state.status === "price_changed" && state.priceChange ? (
          <section
            aria-labelledby="price-changed"
            className="grid gap-2 rounded-lg border border-warning bg-warning-soft p-4"
          >
            <h2 className="text-heading-3 font-bold text-warning" id="price-changed">
              The total changed
            </h2>
            <p className="text-body-sm text-text">
              You were shown <Money minorUnits={state.priceChange.acknowledged} /> but
              the current total is <Money minorUnits={state.priceChange.current} />.
              Nothing has been ordered and nothing has been charged. Press Pay again to
              confirm the new total.
            </p>
          </section>
        ) : null}

        {state.status === "ordered" && state.order ? (
          <section
            className="grid gap-2 rounded-lg border border-success bg-success-soft p-4"
            aria-labelledby="order-placed"
          >
            <h2 className="text-heading-3 font-bold text-success" id="order-placed">
              Order {state.order.reference} placed
            </h2>
            <p className="text-body-sm text-text">
              We are holding your items for {RESERVATION_MINUTES} minutes while the
              payment step opens. Nothing has been charged yet. Keep your reference safe
              — you will need it to track this order.
            </p>
          </section>
        ) : null}

        <DeliveryFields
          errors={state.fieldErrors}
          onChange={setField}
          values={values}
        />
      </div>

      <div className="lg:sticky lg:top-4">
        <CheckoutSummary
          isPending={isPending}
          isRevalidating={isRevalidating}
          itemCount={itemCount}
          totals={totals}
        />
      </div>
    </form>
  );
}
