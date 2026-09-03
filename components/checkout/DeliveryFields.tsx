"use client";

import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CHECKOUT_FIELD_LIMITS } from "@/constants/checkout";
import {
  nigerianStates,
  SUPPORTED_COUNTRY,
  SUPPORTED_COUNTRY_NAME,
} from "@/constants/regions";
import type {
  CheckoutField,
  CheckoutState,
} from "@/features/checkout/schemas/checkout";

const stateOptions: readonly SelectOption[] = nigerianStates.map((state) => ({
  label: state,
  value: state,
}));

const countryOptions: readonly SelectOption[] = [
  { label: SUPPORTED_COUNTRY_NAME, value: SUPPORTED_COUNTRY },
];

export type DeliveryValues = Record<CheckoutField, string>;

export const emptyDeliveryValues: DeliveryValues = {
  address: "",
  city: "",
  country: SUPPORTED_COUNTRY,
  email: "",
  firstName: "",
  instructions: "",
  landmark: "",
  lastName: "",
  phone: "",
  postalCode: "",
  state: "",
};

type DeliveryFieldsProps = {
  errors: CheckoutState["fieldErrors"];
  onChange: (field: CheckoutField, value: string) => void;
  values: DeliveryValues;
};

export function DeliveryFields({ errors, onChange, values }: DeliveryFieldsProps) {
  function fieldProps(field: CheckoutField) {
    return {
      ...(errors[field] ? { error: errors[field] } : {}),
      name: field,
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => {
        onChange(field, event.target.value);
      },
      value: values[field],
    };
  }

  function selectProps(field: CheckoutField) {
    return {
      ...(errors[field] ? { error: errors[field] } : {}),
      name: field,
      onValueChange: (next: string) => {
        onChange(field, next);
      },
      value: values[field],
    };
  }

  return (
    <>
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-heading-3 font-bold text-text">
          Customer information
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            autoComplete="given-name"
            label="First name"
            maxLength={CHECKOUT_FIELD_LIMITS.name}
            required
            {...fieldProps("firstName")}
          />
          <Input
            autoComplete="family-name"
            label="Last name"
            maxLength={CHECKOUT_FIELD_LIMITS.name}
            required
            {...fieldProps("lastName")}
          />
        </div>

        <Input
          autoComplete="email"
          hint="Your order confirmation goes here. No account needed."
          label="Email"
          maxLength={CHECKOUT_FIELD_LIMITS.email}
          required
          type="email"
          {...fieldProps("email")}
        />

        <Input
          autoComplete="tel"
          hint="For delivery updates, for example 0803 123 4567"
          inputMode="tel"
          label="Phone number"
          maxLength={CHECKOUT_FIELD_LIMITS.phone}
          required
          type="tel"
          {...fieldProps("phone")}
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-heading-3 font-bold text-text">
          Delivery information
        </legend>

        <Input
          autoComplete="street-address"
          label="Street address"
          maxLength={CHECKOUT_FIELD_LIMITS.address}
          required
          {...fieldProps("address")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            autoComplete="address-level2"
            label="City or town"
            maxLength={CHECKOUT_FIELD_LIMITS.city}
            required
            {...fieldProps("city")}
          />

          <Select
            autoComplete="address-level1"
            label="State"
            options={stateOptions}
            placeholder="Choose a state"
            required
            {...selectProps("state")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            autoComplete="postal-code"
            hint="Optional"
            inputMode="numeric"
            label="Postal code"
            maxLength={CHECKOUT_FIELD_LIMITS.postalCode}
            {...fieldProps("postalCode")}
          />

          <Select
            autoComplete="country"
            hint="We deliver within Nigeria"
            label="Country"
            options={countryOptions}
            required
            {...selectProps("country")}
          />
        </div>

        <Input
          hint="Optional. Something nearby that helps the rider find you."
          label="Landmark"
          maxLength={CHECKOUT_FIELD_LIMITS.landmark}
          {...fieldProps("landmark")}
        />

        <Textarea
          hint="Optional. Gate code, preferred time, anything the rider should know."
          label="Delivery instructions"
          maxLength={CHECKOUT_FIELD_LIMITS.instructions}
          rows={3}
          {...fieldProps("instructions")}
        />
      </fieldset>
    </>
  );
}
