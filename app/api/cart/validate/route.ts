import { NextResponse } from "next/server";

import { CART_BURST_LIMIT } from "@/constants/cart";
import { cartValidationRequestSchema } from "@/features/cart/schemas/cart";
import { EMPTY_CART_VALIDATION, validateCart } from "@/server/services/cart";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { getRequestContext } from "@/server/security/request-context";

export async function POST(request: Request) {
  const context = await getRequestContext();
  const burst = checkMemoryRateLimit(CART_BURST_LIMIT, context.ip ?? "unknown");

  if (!burst.allowed) {
    return NextResponse.json(EMPTY_CART_VALIDATION, {
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.max(1, burst.retryAfterSeconds)),
      },
      status: 429,
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(EMPTY_CART_VALIDATION, {
      headers: { "cache-control": "no-store" },
      status: 400,
    });
  }

  const parsed = cartValidationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(EMPTY_CART_VALIDATION, {
      headers: { "cache-control": "no-store" },
      status: 400,
    });
  }

  if (parsed.data.lines.length === 0) {
    return NextResponse.json(EMPTY_CART_VALIDATION, {
      headers: { "cache-control": "no-store" },
      status: 200,
    });
  }

  try {
    const validation = await validateCart(parsed.data.lines);

    return NextResponse.json(validation, {
      headers: { "cache-control": "no-store" },
      status: 200,
    });
  } catch (error) {
    console.error("cart_validation_failed", {
      error: error instanceof Error ? error.message : "unknown",
      lines: parsed.data.lines.length,
      requestId: context.requestId,
    });

    return NextResponse.json(EMPTY_CART_VALIDATION, {
      headers: { "cache-control": "no-store" },
      status: 500,
    });
  }
}
