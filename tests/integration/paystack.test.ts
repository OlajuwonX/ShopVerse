import { describe, expect, it } from "vitest";

import { createPaymentReference } from "@/lib/order-reference";
import { initializeTransaction } from "@/server/payments/paystack";

const secret = process.env.PAYSTACK_SECRET_KEY;
const hasKey = typeof secret === "string" && secret.startsWith("sk_test_");

describe.skipIf(!hasKey)("Paystack sandbox", () => {
  it("initializes a real transaction and returns an authorization url", async () => {
    const reference = createPaymentReference();

    const result = await initializeTransaction(
      {
        amountMinor: 500_00,
        callbackUrl: "http://localhost:3000/checkout/callback",
        currency: "NGN",
        email: "buyer@shopverse-sandbox.example.com",
        metadata: { order_reference: "SV-LIVETEST" },
        reference,
      },
      { secret },
    );

    expect(result.status, JSON.stringify(result)).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.providerReference).toBe(reference);
    expect(result.authorizationUrl).toMatch(/^https:\/\/checkout\.paystack\.com\//);
    expect(result.accessCode.length).toBeGreaterThan(0);
  });

  it("refuses a reused reference, proving each retry needs a fresh one", async () => {
    const reference = createPaymentReference();

    const first = await initializeTransaction(
      {
        amountMinor: 500_00,
        callbackUrl: "http://localhost:3000/checkout/callback",
        currency: "NGN",
        email: "buyer@shopverse-sandbox.example.com",
        metadata: { order_reference: "SV-LIVETEST" },
        reference,
      },
      { secret },
    );

    expect(first.status).toBe("ok");

    const second = await initializeTransaction(
      {
        amountMinor: 500_00,
        callbackUrl: "http://localhost:3000/checkout/callback",
        currency: "NGN",
        email: "buyer@shopverse-sandbox.example.com",
        metadata: { order_reference: "SV-LIVETEST" },
        reference,
      },
      { secret },
    );

    expect(second.status).toBe("rejected");
  });

  it("rejects a bad secret without leaking it", async () => {
    const result = await initializeTransaction(
      {
        amountMinor: 500_00,
        callbackUrl: "http://localhost:3000/checkout/callback",
        currency: "NGN",
        email: "buyer@shopverse-sandbox.example.com",
        metadata: { order_reference: "SV-LIVETEST" },
        reference: createPaymentReference(),
      },
      { secret: "sk_test_0000000000000000000000000000000000000000" },
    );

    expect(result.status).toBe("rejected");
    expect(JSON.stringify(result)).not.toContain("sk_test_0000");
  });
});
