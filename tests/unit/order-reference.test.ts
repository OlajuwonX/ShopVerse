import { describe, expect, it } from "vitest";

import {
  createOrderReference,
  createPaymentReference,
  PAYMENT_REFERENCE_PATTERN,
  isOrderReference,
  ORDER_REFERENCE_PREFIX,
} from "@/lib/order-reference";

describe("createOrderReference", () => {
  it("produces the documented SV- shape (MASTER §28)", () => {
    const reference = createOrderReference();

    expect(reference.startsWith(ORDER_REFERENCE_PREFIX)).toBe(true);
    expect(reference).toHaveLength(ORDER_REFERENCE_PREFIX.length + 8);
    expect(isOrderReference(reference)).toBe(true);
  });

  it("never emits characters that can be misread aloud", () => {
    const references = Array.from({ length: 300 }, () => createOrderReference());

    for (const reference of references) {
      expect(reference.slice(ORDER_REFERENCE_PREFIX.length)).not.toMatch(/[01IO]/);
    }
  });

  it("is not sequential — consecutive calls share no pattern (SEC-13)", () => {
    const references = Array.from({ length: 500 }, () => createOrderReference());

    expect(new Set(references).size).toBe(references.length);
  });

  it("draws every character from the random source", () => {
    const reference = createOrderReference(() => new Uint8Array(8).fill(0));

    expect(reference).toBe(`${ORDER_REFERENCE_PREFIX}22222222`);
  });

  it("maps the random source across the whole alphabet", () => {
    const seen = new Set<string>();

    for (let value = 0; value < 32; value += 1) {
      const reference = createOrderReference(() => new Uint8Array(8).fill(value));

      seen.add(reference.charAt(ORDER_REFERENCE_PREFIX.length));
    }

    expect(seen.size).toBe(32);
  });
});

describe("isOrderReference", () => {
  it("rejects anything that is not a ShopVerse reference", () => {
    for (const value of [
      "",
      "SV-",
      "SV-1234567",
      "SV-123456789",
      "sv-ABCDEFGH",
      "SV-ABCDEFG0",
      "SV-ABCDEFGI",
      "12345678",
      "SV-ABCDEFG!",
    ]) {
      expect(isOrderReference(value), value).toBe(false);
    }
  });
});

describe("createPaymentReference", () => {
  it("is distinct from the customer-facing order reference", () => {
    const payment = createPaymentReference();

    expect(payment.startsWith("sv-")).toBe(true);
    expect(isOrderReference(payment)).toBe(false);
  });

  it("uses only characters Paystack accepts in a transaction reference", () => {
    for (let i = 0; i < 200; i += 1) {
      const payment = createPaymentReference();

      expect(payment, payment).toMatch(PAYMENT_REFERENCE_PATTERN);
      expect(payment, payment).toMatch(/^[A-Za-z0-9\-.=]+$/);
    }
  });

  it("is unique across many calls", () => {
    const references = Array.from({ length: 500 }, () => createPaymentReference());

    expect(new Set(references).size).toBe(references.length);
  });
});
