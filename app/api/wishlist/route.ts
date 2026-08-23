import { NextResponse } from "next/server";

import {
  WISHLIST_BURST_LIMIT,
  WISHLIST_IDS_PARAM,
  WISHLIST_MAX_ITEMS,
} from "@/constants/wishlist";
import { normaliseWishlistIds } from "@/features/wishlist/schemas/wishlist";
import { getProductsByIds } from "@/server/cache/catalogue";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { getRequestContext } from "@/server/security/request-context";

const EMPTY = { items: [] };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get(WISHLIST_IDS_PARAM) ?? "";
  const requested = normaliseWishlistIds(raw.split(",").slice(0, WISHLIST_MAX_ITEMS));

  if (requested.length === 0) {
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "no-store" },
      status: 200,
    });
  }

  const context = await getRequestContext();
  const burst = checkMemoryRateLimit(WISHLIST_BURST_LIMIT, context.ip ?? "unknown");

  if (!burst.allowed) {
    return NextResponse.json(EMPTY, {
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.max(1, burst.retryAfterSeconds)),
      },
      status: 429,
    });
  }

  try {
    const items = await getProductsByIds(requested);

    return NextResponse.json(
      { items },
      { headers: { "cache-control": "private, max-age=30" }, status: 200 },
    );
  } catch (error) {
    console.error("wishlist_hydration_failed", {
      error: error instanceof Error ? error.message : "unknown",
      requestId: context.requestId,
      requested: requested.length,
    });

    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "no-store" },
      status: 500,
    });
  }
}
