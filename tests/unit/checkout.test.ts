import { describe, expect, it } from "vitest";

import {
  CHECKOUT_FIELD_LIMITS,
  CHECKOUT_HONEYPOT_FIELD,
  CHECKOUT_RENDERED_AT_FIELD,
} from "@/constants/checkout";
import { nigerianStates, isSupportedState } from "@/constants/regions";
import {
  checkoutSubmissionSchema,
  deliveryDetailsSchema,
  normalisePhone,
  toFieldErrors,
} from "@/features/checkout/schemas/checkout";
import { quoteDelivery } from "@/server/services/delivery";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "a1111111-1111-4111-8111-111111111111";

function details(overrides: Record<string, unknown> = {}) {
  return {
    address: "12 Adeola Odeku Street",
    city: "Victoria Island",
    country: "NG",
    email: "buyer@example.com",
    firstName: "Ada",
    lastName: "Obi",
    phone: "08031234567",
    state: "Lagos",
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    ...details(),
    checkoutAttemptId: "22222222-2222-4222-8222-222222222222",
    lines: [{ productId: PRODUCT, quantity: 1, variantId: VARIANT }],
    [CHECKOUT_HONEYPOT_FIELD]: "",
    [CHECKOUT_RENDERED_AT_FIELD]: Date.now() - 10_000,
    ...overrides,
  };
}

describe("normalisePhone", () => {
  it("normalises every accepted Nigerian form to a leading zero", () => {
    expect(normalisePhone("+2348031234567")).toBe("08031234567");
    expect(normalisePhone("2348031234567")).toBe("08031234567");
    expect(normalisePhone("0803 123 4567")).toBe("08031234567");
    expect(normalisePhone("(0803)-123-4567")).toBe("08031234567");
  });
});

describe("deliveryDetailsSchema", () => {
  it("accepts a complete set of details", () => {
    const parsed = deliveryDetailsSchema.safeParse(details());

    expect(parsed.success).toBe(true);
    expect(parsed.data?.phone).toBe("08031234567");
    expect(parsed.data?.landmark).toBe("");
    expect(parsed.data?.instructions).toBe("");
    expect(parsed.data?.postalCode).toBe("");
  });

  it("trims whitespace rather than rejecting it", () => {
    const parsed = deliveryDetailsSchema.safeParse(
      details({ city: "  Ikeja  ", firstName: "  Ada  " }),
    );

    expect(parsed.data?.firstName).toBe("Ada");
    expect(parsed.data?.city).toBe("Ikeja");
  });

  it("rejects a blank required field with a readable message", () => {
    const parsed = deliveryDetailsSchema.safeParse(details({ firstName: "   " }));

    expect(parsed.success).toBe(false);
    expect(toFieldErrors(parsed.error!).firstName).toBe("Enter your first name");
  });

  it("rejects an invalid email", () => {
    const parsed = deliveryDetailsSchema.safeParse(details({ email: "not-an-email" }));

    expect(toFieldErrors(parsed.error!).email).toBe("Enter a valid email address");
  });

  it("rejects a phone number that is not Nigerian", () => {
    for (const phone of ["1234567890", "+15551234567", "0801234", "080312345678"]) {
      const parsed = deliveryDetailsSchema.safeParse(details({ phone }));

      expect(parsed.success, phone).toBe(false);
      expect(toFieldErrors(parsed.error!).phone).toMatch(/Nigerian phone number/);
    }
  });

  it("accepts every Nigerian mobile prefix form", () => {
    for (const phone of ["08031234567", "07061234567", "09011234567", "08101234567"]) {
      expect(deliveryDetailsSchema.safeParse(details({ phone })).success, phone).toBe(
        true,
      );
    }
  });

  it("treats the postal code as optional but validates its format", () => {
    expect(deliveryDetailsSchema.safeParse(details({ postalCode: "" })).success).toBe(
      true,
    );
    expect(
      deliveryDetailsSchema.safeParse(details({ postalCode: "100001" })).success,
    ).toBe(true);

    const bad = deliveryDetailsSchema.safeParse(details({ postalCode: "12ab" }));

    expect(bad.success).toBe(false);
    expect(toFieldErrors(bad.error!).postalCode).toMatch(/six digits/);
  });

  it("rejects a state outside the supported set", () => {
    const parsed = deliveryDetailsSchema.safeParse(details({ state: "Atlantis" }));

    expect(parsed.success).toBe(false);
    expect(toFieldErrors(parsed.error!).state).toBe("Choose your state");
  });

  it("rejects a country we do not deliver to", () => {
    const parsed = deliveryDetailsSchema.safeParse(details({ country: "GH" }));

    expect(parsed.success).toBe(false);
    expect(toFieldErrors(parsed.error!).country).toMatch(/Nigeria only/);
  });

  it("bounds every free-text field", () => {
    const parsed = deliveryDetailsSchema.safeParse(
      details({
        address: "x".repeat(CHECKOUT_FIELD_LIMITS.address + 1),
        instructions: "y".repeat(CHECKOUT_FIELD_LIMITS.instructions + 1),
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("strips unknown keys rather than carrying them through (SEC-05)", () => {
    const parsed = deliveryDetailsSchema.safeParse(
      details({ deliveryFee: 0, isAdmin: true, total: 1 }),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("isAdmin");
    expect(parsed.data).not.toHaveProperty("total");
    expect(parsed.data).not.toHaveProperty("deliveryFee");
  });
});

describe("checkoutSubmissionSchema", () => {
  it("accepts a well-formed submission", () => {
    expect(checkoutSubmissionSchema.safeParse(submission()).success).toBe(true);
  });

  it("requires at least one line", () => {
    const parsed = checkoutSubmissionSchema.safeParse(submission({ lines: [] }));

    expect(parsed.success).toBe(false);
  });

  it("carries no money field at all", () => {
    const parsed = checkoutSubmissionSchema.safeParse(
      submission({ lines: [{ productId: PRODUCT, quantity: 1, variantId: VARIANT }] }),
    );

    const serialised = JSON.stringify(parsed.data);

    expect(serialised).not.toMatch(/price|total|amount|fee/i);
    expect(Object.keys(parsed.data!.lines[0]!).sort()).toStrictEqual([
      "productId",
      "quantity",
      "variantId",
    ]);
  });

  it("requires a uuid checkout attempt id", () => {
    expect(
      checkoutSubmissionSchema.safeParse(submission({ checkoutAttemptId: "abc" }))
        .success,
    ).toBe(false);
  });

  it("requires the honeypot to be empty", () => {
    const parsed = checkoutSubmissionSchema.safeParse(
      submission({ [CHECKOUT_HONEYPOT_FIELD]: "bot" }),
    );

    expect(parsed.success).toBe(false);
  });
});

describe("supported regions", () => {
  it("covers 36 states plus the Federal Capital Territory", () => {
    expect(nigerianStates).toHaveLength(37);
    expect(nigerianStates).toContain("Federal Capital Territory");
  });

  it("recognises only listed states", () => {
    expect(isSupportedState("Lagos")).toBe(true);
    expect(isSupportedState("lagos")).toBe(false);
    expect(isSupportedState("Atlantis")).toBe(false);
  });
});

describe("quoteDelivery", () => {
  it("prices Lagos, nearby states and the rest of the country differently", () => {
    const lagos = quoteDelivery("Lagos");
    const nearby = quoteDelivery("Oyo");
    const far = quoteDelivery("Borno");

    expect(lagos?.zone).toBe("lagos");
    expect(nearby?.zone).toBe("nearby");
    expect(far?.zone).toBe("nationwide");

    expect(lagos!.fee).toBeLessThan(nearby!.fee);
    expect(nearby!.fee).toBeLessThan(far!.fee);
  });

  it("quotes every supported state", () => {
    for (const state of nigerianStates) {
      const quote = quoteDelivery(state);

      expect(quote, state).not.toBeNull();
      expect(Number.isInteger(quote!.fee)).toBe(true);
      expect(quote!.fee).toBeGreaterThan(0);
    }
  });

  it("refuses an unsupported state instead of guessing", () => {
    expect(quoteDelivery("Atlantis")).toBeNull();
    expect(quoteDelivery("")).toBeNull();
  });
});
