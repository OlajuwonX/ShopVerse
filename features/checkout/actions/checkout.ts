"use server";

import {
  CHECKOUT_BURST_LIMIT,
  CHECKOUT_HONEYPOT_FIELD,
  CHECKOUT_MIN_FILL_MS,
  CHECKOUT_RENDERED_AT_FIELD,
  CHECKOUT_SUSTAINED_LIMIT,
} from "@/constants/checkout";
import {
  cartLineInputSchema,
  cartLineKey,
  type CartLineInput,
} from "@/features/cart/schemas/cart";
import {
  checkoutSubmissionSchema,
  toFieldErrors,
  type CheckoutState,
} from "@/features/checkout/schemas/checkout";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { writeAuditLog } from "@/server/security/audit";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { assertSameOrigin } from "@/server/security/origin";
import { getRequestContext } from "@/server/security/request-context";
import { validateCart } from "@/server/services/cart";
import { quoteDelivery } from "@/server/services/delivery";
import { createPendingOrder, type CreateOrderIssue } from "@/server/services/orders";

const GENERIC_FAILURE =
  "We could not start your checkout. Check your details and try again.";

const CART_CHANGED =
  "Something in your cart changed. Review the updated cart and try again.";

const TOO_MANY = "Too many checkout attempts. Wait a few minutes before trying again.";

const CART_UNREADABLE =
  "We could not read your cart. Refresh the page and try again — nothing has been ordered.";

function describeIssues(issues: readonly CreateOrderIssue[]) {
  const first = issues[0];

  if (!first) {
    return CART_CHANGED;
  }

  const name = first.productName ?? "An item in your cart";

  if (first.code === "INSUFFICIENT_STOCK") {
    return first.available === 0
      ? `${name} sold out while you were checking out. Remove it and try again.`
      : `Only ${first.available} of ${name} remain. Reduce the quantity and try again.`;
  }

  if (first.code === "VARIANT_UNAVAILABLE") {
    return `That option of ${name} is no longer sold. Choose another option and try again.`;
  }

  return `${name} is no longer available. Remove it and try again.`;
}

function invalid(
  fieldErrors: CheckoutState["fieldErrors"],
  formError: string | null,
): CheckoutState {
  return { fieldErrors, formError, status: "invalid", validatedAttemptId: null };
}

function parseLines(raw: FormDataEntryValue | null): CartLineInput[] | null {
  if (typeof raw !== "string") {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const lines: CartLineInput[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    const result = cartLineInputSchema.safeParse(entry);

    if (!result.success) {
      return null;
    }

    const key = cartLineKey(result.data);

    if (seen.has(key)) {
      return null;
    }

    seen.add(key);
    lines.push(result.data);
  }

  return lines;
}

async function runCheckout(formData: FormData): Promise<CheckoutState> {
  const context = await getRequestContext();
  const identifier = context.ip ?? "unknown";

  if (!checkMemoryRateLimit(CHECKOUT_BURST_LIMIT, identifier).allowed) {
    return invalid({}, TOO_MANY);
  }

  const sustained = await checkRateLimit(CHECKOUT_SUSTAINED_LIMIT, identifier);

  if (!sustained.allowed) {
    return invalid({}, TOO_MANY);
  }

  const lines = parseLines(formData.get("lines"));

  if (lines === null) {
    return invalid({}, CART_UNREADABLE);
  }

  const parsed = checkoutSubmissionSchema.safeParse({
    acknowledgedTotal: formData.get("acknowledgedTotal"),
    address: formData.get("address"),
    checkoutAttemptId: formData.get("checkoutAttemptId"),
    city: formData.get("city"),
    country: formData.get("country"),
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    instructions: formData.get("instructions") ?? "",
    landmark: formData.get("landmark") ?? "",
    lastName: formData.get("lastName"),
    lines,
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode") ?? "",
    state: formData.get("state"),
    [CHECKOUT_HONEYPOT_FIELD]: formData.get(CHECKOUT_HONEYPOT_FIELD) ?? "",
    [CHECKOUT_RENDERED_AT_FIELD]: formData.get(CHECKOUT_RENDERED_AT_FIELD),
  });

  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error);

    return invalid(
      fieldErrors,
      Object.keys(fieldErrors).length > 0
        ? "Check the highlighted fields and try again."
        : GENERIC_FAILURE,
    );
  }

  if (parsed.data[CHECKOUT_HONEYPOT_FIELD] !== "") {
    await writeAuditLog({
      action: "checkout.rejected",
      actorType: "system",
      after: { reason: "honeypot" },
      targetType: "checkout",
    });

    return invalid({}, GENERIC_FAILURE);
  }

  if (Date.now() - parsed.data[CHECKOUT_RENDERED_AT_FIELD] < CHECKOUT_MIN_FILL_MS) {
    await writeAuditLog({
      action: "checkout.rejected",
      actorType: "system",
      after: { reason: "submitted_too_fast" },
      targetType: "checkout",
    });

    return invalid({}, GENERIC_FAILURE);
  }

  const validation = await validateCart(parsed.data.lines, {
    deliveryState: parsed.data.state,
  });

  const unpurchasable = validation.lines.filter((line) => !line.purchasable);
  const reduced = validation.lines.filter((line) =>
    line.issues.some((issue) => issue.code === "QUANTITY_REDUCED"),
  );

  if (unpurchasable.length > 0 || reduced.length > 0) {
    return {
      fieldErrors: {},
      formError: CART_CHANGED,
      status: "cart_changed",
      validatedAttemptId: null,
    };
  }

  if (validation.lines.length === 0) {
    return invalid({}, "Your cart is empty.");
  }

  const delivery = quoteDelivery(parsed.data.state);

  if (!delivery) {
    return invalid({ state: "We do not deliver to that state yet" }, GENERIC_FAILURE);
  }

  const created = await createPendingOrder({
    acknowledgedTotal: parsed.data.acknowledgedTotal,
    checkoutAttemptId: parsed.data.checkoutAttemptId,
    delivery: parsed.data,
    lines: parsed.data.lines,
  });

  if (created.status === "price_changed") {
    await writeAuditLog({
      action: "checkout.price_changed",
      actorType: "system",
      after: {
        acknowledged: created.acknowledged,
        attemptId: parsed.data.checkoutAttemptId,
        current: created.current,
      },
      targetType: "checkout",
    });

    return {
      fieldErrors: {},
      formError:
        "The total changed while you were checking out. Nothing has been ordered — review the new total and confirm.",
      priceChange: { acknowledged: created.acknowledged, current: created.current },
      status: "price_changed",
      validatedAttemptId: null,
    };
  }

  if (created.status === "unavailable") {
    await writeAuditLog({
      action: "checkout.unavailable",
      actorType: "system",
      after: {
        attemptId: parsed.data.checkoutAttemptId,
        issues: created.issues.map((issue) => issue.code),
      },
      targetType: "checkout",
    });

    return {
      fieldErrors: {},
      formError: describeIssues(created.issues),
      status: "cart_changed",
      validatedAttemptId: null,
    };
  }

  if (created.status === "rejected") {
    return invalid({}, created.reason);
  }

  await writeAuditLog({
    action: created.status === "replayed" ? "checkout.replayed" : "checkout.ordered",
    actorType: "system",
    after: {
      attemptId: parsed.data.checkoutAttemptId,
      deliveryZone: delivery.zone,
      lineCount: validation.lines.length,
      orderReference: created.order.reference,
    },
    targetId: created.order.id,
    targetType: "order",
  });

  return {
    fieldErrors: {},
    formError: null,
    order: {
      grandTotal: created.order.grandTotal,
      reference: created.order.reference,
    },
    status: "ordered",
    validatedAttemptId: parsed.data.checkoutAttemptId,
  };
}

export async function submitCheckout(
  _previousState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  try {
    await assertSameOrigin();
  } catch {
    return invalid({}, GENERIC_FAILURE);
  }

  try {
    return await runCheckout(formData);
  } catch (error) {
    const { requestId } = await getRequestContext();

    console.error("checkout_submit_failed", {
      error: error instanceof Error ? error.message : "unknown",
      requestId,
    });

    return invalid(
      {},
      `Something went wrong on our side and your checkout was not started. Nothing was charged. Try again, or quote reference ${requestId}.`,
    );
  }
}
