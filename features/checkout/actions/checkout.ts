"use server";

import {
  CHECKOUT_BURST_LIMIT,
  CHECKOUT_HONEYPOT_FIELD,
  CHECKOUT_MIN_FILL_MS,
  CHECKOUT_RENDERED_AT_FIELD,
  CHECKOUT_SUSTAINED_LIMIT,
} from "@/constants/checkout";
import { cartLineInputSchema } from "@/features/cart/schemas/cart";
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

const GENERIC_FAILURE =
  "We could not start your checkout. Check your details and try again.";

const CART_CHANGED =
  "Something in your cart changed. Review the updated cart and try again.";

const TOO_MANY = "Too many checkout attempts. Wait a few minutes before trying again.";

function invalid(
  fieldErrors: CheckoutState["fieldErrors"],
  formError: string | null,
): CheckoutState {
  return { fieldErrors, formError, status: "invalid", validatedAttemptId: null };
}

function parseLines(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => cartLineInputSchema.safeParse(entry))
      .flatMap((result) => (result.success ? [result.data] : []));
  } catch {
    return [];
  }
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

  const parsed = checkoutSubmissionSchema.safeParse({
    address: formData.get("address"),
    checkoutAttemptId: formData.get("checkoutAttemptId"),
    city: formData.get("city"),
    country: formData.get("country"),
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    instructions: formData.get("instructions") ?? "",
    landmark: formData.get("landmark") ?? "",
    lastName: formData.get("lastName"),
    lines: parseLines(formData.get("lines")),
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

  await writeAuditLog({
    action: "checkout.validated",
    actorType: "system",
    after: {
      attemptId: parsed.data.checkoutAttemptId,
      deliveryZone: delivery.zone,
      lineCount: validation.lines.length,
    },
    targetType: "checkout",
  });

  return {
    fieldErrors: {},
    formError: null,
    status: "validated",
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
