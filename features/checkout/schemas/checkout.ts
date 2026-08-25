import { z } from "zod";

import {
  CHECKOUT_FIELD_LIMITS,
  CHECKOUT_HONEYPOT_FIELD,
  CHECKOUT_RENDERED_AT_FIELD,
} from "@/constants/checkout";
import { nigerianStates, SUPPORTED_COUNTRY } from "@/constants/regions";
import { cartLineInputSchema } from "@/features/cart/schemas/cart";
import { CART_MAX_LINES } from "@/constants/cart";

const trimmed = (max: number) => z.string().trim().max(max);

const requiredText = (max: number, message: string) => trimmed(max).min(1, { message });

export const NIGERIAN_PHONE_PATTERN = /^(?:\+?234|0)[789][01]\d{8}$/;
export const NIGERIAN_POSTAL_PATTERN = /^\d{6}$/;

export function normalisePhone(value: string) {
  const digits = value.replace(/[\s()-]/g, "");

  if (digits.startsWith("+234")) {
    return `0${digits.slice(4)}`;
  }

  if (digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }

  return digits;
}

export const deliveryDetailsSchema = z.object({
  address: requiredText(CHECKOUT_FIELD_LIMITS.address, "Enter your street address"),
  city: requiredText(CHECKOUT_FIELD_LIMITS.city, "Enter your city or town"),
  country: z.literal(SUPPORTED_COUNTRY, {
    message: "We currently deliver within Nigeria only",
  }),
  email: requiredText(CHECKOUT_FIELD_LIMITS.email, "Enter your email address").pipe(
    z.email({ message: "Enter a valid email address" }),
  ),
  firstName: requiredText(CHECKOUT_FIELD_LIMITS.name, "Enter your first name"),
  instructions: trimmed(CHECKOUT_FIELD_LIMITS.instructions).optional().default(""),
  landmark: trimmed(CHECKOUT_FIELD_LIMITS.landmark).optional().default(""),
  lastName: requiredText(CHECKOUT_FIELD_LIMITS.name, "Enter your last name"),
  phone: requiredText(CHECKOUT_FIELD_LIMITS.phone, "Enter your phone number")
    .transform(normalisePhone)
    .refine((value) => NIGERIAN_PHONE_PATTERN.test(value), {
      message: "Enter a Nigerian phone number, for example 0803 123 4567",
    }),
  postalCode: trimmed(CHECKOUT_FIELD_LIMITS.postalCode)
    .optional()
    .default("")
    .refine((value) => value === "" || NIGERIAN_POSTAL_PATTERN.test(value), {
      message: "A postal code is six digits, for example 100001",
    }),
  state: z.enum(nigerianStates, { message: "Choose your state" }),
});

export type DeliveryDetails = z.infer<typeof deliveryDetailsSchema>;

export const checkoutSubmissionSchema = deliveryDetailsSchema.extend({
  checkoutAttemptId: z.uuid({ message: "Restart checkout and try again" }),
  lines: z
    .array(cartLineInputSchema)
    .min(1, { message: "Your cart is empty" })
    .max(CART_MAX_LINES),
  [CHECKOUT_HONEYPOT_FIELD]: z
    .string()
    .max(0, { message: "Unexpected value" })
    .optional()
    .default(""),
  [CHECKOUT_RENDERED_AT_FIELD]: z.coerce.number().int().positive(),
});

export type CheckoutSubmission = z.infer<typeof checkoutSubmissionSchema>;

export const checkoutFields = [
  "address",
  "city",
  "country",
  "email",
  "firstName",
  "instructions",
  "landmark",
  "lastName",
  "phone",
  "postalCode",
  "state",
] as const;

export type CheckoutField = (typeof checkoutFields)[number];

export type CheckoutState = {
  fieldErrors: Partial<Record<CheckoutField, string>>;
  formError: string | null;
  status: "idle" | "invalid" | "cart_changed" | "validated";
  validatedAttemptId: string | null;
};

export const initialCheckoutState: CheckoutState = {
  fieldErrors: {},
  formError: null,
  status: "idle",
  validatedAttemptId: null,
};

const fieldLookup = new Set<string>(checkoutFields);

export function toFieldErrors(error: z.ZodError): CheckoutState["fieldErrors"] {
  const fieldErrors: CheckoutState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (typeof key === "string" && fieldLookup.has(key) && !(key in fieldErrors)) {
      fieldErrors[key as CheckoutField] = issue.message;
    }
  }

  return fieldErrors;
}
