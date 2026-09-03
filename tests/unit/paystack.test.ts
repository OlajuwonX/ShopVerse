import { describe, expect, it } from "vitest";

import {
  initializeTransaction,
  type PaystackInitializeInput,
} from "@/server/payments/paystack";

const SECRET = "sk_test_abc123";

const input: PaystackInitializeInput = {
  amountMinor: 805120000,
  callbackUrl: "http://localhost:3000/checkout/callback",
  currency: "NGN",
  email: "buyer@example.test",
  metadata: { order_reference: "SV-2KBP2PZV" },
  reference: "sv-abcdefghijklmnop",
};

function respond(body: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status,
    });
}

const okBody = {
  data: {
    access_code: "0peioxfhpn",
    authorization_url: "https://checkout.paystack.com/0peioxfhpn",
    reference: "sv-abcdefghijklmnop",
  },
  message: "Authorization URL created",
  status: true,
};

describe("initializeTransaction", () => {
  it("reports not_configured when no secret is available", async () => {
    const result = await initializeTransaction(input, {
      secret: undefined,
      transport: respond(okBody),
    });

    expect(result.status).toBe("not_configured");
  });

  it("returns the authorization url on success", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: respond(okBody),
    });

    expect(result).toStrictEqual({
      accessCode: "0peioxfhpn",
      authorizationUrl: "https://checkout.paystack.com/0peioxfhpn",
      providerReference: "sv-abcdefghijklmnop",
      status: "ok",
    });
  });

  it("sends the amount in minor units and never a client-supplied one", async () => {
    let sent: Record<string, unknown> = {};

    await initializeTransaction(input, {
      secret: SECRET,
      transport: async (_url, init) => {
        sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify(okBody), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    });

    expect(sent.amount).toBe(805120000);
    expect(sent.currency).toBe("NGN");
    expect(sent.reference).toBe("sv-abcdefghijklmnop");
  });

  it("sends only safe metadata, never the delivery address or internal ids", async () => {
    let sent: Record<string, unknown> = {};

    await initializeTransaction(input, {
      secret: SECRET,
      transport: async (_url, init) => {
        sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify(okBody), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    });

    expect(sent.metadata).toStrictEqual({ order_reference: "SV-2KBP2PZV" });
    expect(JSON.stringify(sent)).not.toMatch(
      /address|phone|firstName|lastName|[0-9a-f]{8}-[0-9a-f]{4}/i,
    );
  });

  it("authorises with the secret and never returns it", async () => {
    let header: string | null = null;

    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: async (_url, init) => {
        header = new Headers(init?.headers).get("authorization");
        return new Response(JSON.stringify(okBody), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    });

    expect(header).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("treats a provider refusal as rejected, not retryable", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: respond(
        { message: "Duplicate Transaction Reference", status: false },
        400,
      ),
    });

    expect(result).toStrictEqual({
      message: "Duplicate Transaction Reference",
      status: "rejected",
    });
  });

  it("treats a 200 with status false as rejected", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: respond({ message: "Invalid amount", status: false }),
    });

    expect(result.status).toBe("rejected");
  });

  it("treats a provider 5xx as retryable", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: respond({ message: "server error", status: false }, 503),
    });

    expect(result).toStrictEqual({ reason: "provider_503", status: "unavailable" });
  });

  it("treats a network failure as retryable", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: async () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(result.status).toBe("unavailable");
  });

  it("treats an unreadable body as retryable rather than crashing", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: async () =>
        new Response("<html>gateway</html>", {
          headers: { "content-type": "text/html" },
          status: 200,
        }),
    });

    expect(result).toStrictEqual({
      reason: "unreadable_response",
      status: "unavailable",
    });
  });

  it("treats a success envelope with a missing url as retryable", async () => {
    const result = await initializeTransaction(input, {
      secret: SECRET,
      transport: respond({ data: { access_code: "x" }, status: true }),
    });

    expect(result).toStrictEqual({
      reason: "unexpected_data_shape",
      status: "unavailable",
    });
  });
});
