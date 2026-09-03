import "server-only";

import { z } from "zod";

import { serverEnv } from "@/config/env";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 15_000;

const initializeDataSchema = z.object({
  access_code: z.string().min(1),
  authorization_url: z.string().url(),
  reference: z.string().min(1),
});

const envelopeSchema = z.object({
  data: z.unknown().optional(),
  message: z.string().optional(),
  status: z.boolean().optional(),
});

export type PaystackInitializeInput = {
  amountMinor: number;
  callbackUrl: string;
  currency: string;
  email: string;
  metadata: Record<string, string | number>;
  reference: string;
};

export type PaystackInitializeResult =
  | {
      accessCode: string;
      authorizationUrl: string;
      providerReference: string;
      status: "ok";
    }
  | { status: "not_configured" }
  | { message: string; status: "rejected" }
  | { reason: string; status: "unavailable" };

export type PaystackTransport = typeof fetch;

function authorisationHeader(secret: string) {
  return `Bearer ${secret}`;
}

export function isPaystackConfigured() {
  return typeof serverEnv.PAYSTACK_SECRET_KEY === "string";
}

export function paystackMode() {
  const key = serverEnv.PAYSTACK_SECRET_KEY;

  if (key === undefined) {
    return "unconfigured" as const;
  }

  return key.startsWith("sk_live_") ? ("live" as const) : ("test" as const);
}

export async function initializeTransaction(
  input: PaystackInitializeInput,
  options: { secret?: string | undefined; transport?: PaystackTransport } = {},
): Promise<PaystackInitializeResult> {
  const secret = options.secret ?? serverEnv.PAYSTACK_SECRET_KEY;

  if (secret === undefined || secret.length === 0) {
    return { status: "not_configured" };
  }

  const transport = options.transport ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await transport(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      body: JSON.stringify({
        amount: input.amountMinor,
        callback_url: input.callbackUrl,
        currency: input.currency,
        email: input.email,
        metadata: input.metadata,
        reference: input.reference,
      }),
      headers: {
        "content-type": "application/json",
        authorization: authorisationHeader(secret),
      },
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    return {
      reason: error instanceof Error ? error.name : "network_error",
      status: "unavailable",
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 500) {
    return { reason: `provider_${response.status}`, status: "unavailable" };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { reason: "unreadable_response", status: "unavailable" };
  }

  const envelope = envelopeSchema.safeParse(payload);

  if (!envelope.success) {
    return { reason: "unexpected_response_shape", status: "unavailable" };
  }

  if (!response.ok || envelope.data.status !== true) {
    return {
      message: envelope.data.message ?? "Paystack rejected the transaction",
      status: "rejected",
    };
  }

  const data = initializeDataSchema.safeParse(envelope.data.data);

  if (!data.success) {
    return { reason: "unexpected_data_shape", status: "unavailable" };
  }

  return {
    accessCode: data.data.access_code,
    authorizationUrl: data.data.authorization_url,
    providerReference: data.data.reference,
    status: "ok",
  };
}
