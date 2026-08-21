import { NextResponse } from "next/server";
import { z } from "zod";

import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SEARCH_RATE_LIMIT,
} from "@/constants/search";
import { getCachedSearchSuggestions } from "@/server/cache/search";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { getRequestContext } from "@/server/security/request-context";

const querySchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH),
});

const EMPTY = { brands: [], categories: [], products: [], term: "" };

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(EMPTY, {
      headers: { "cache-control": "no-store" },
      status: 200,
    });
  }

  const context = await getRequestContext();
  const limit = checkMemoryRateLimit(SEARCH_RATE_LIMIT, context.ip ?? "unknown");

  if (!limit.allowed) {
    return NextResponse.json(
      { ...EMPTY, term: parsed.data.q },
      {
        headers: {
          "cache-control": "no-store",
          "retry-after": String(limit.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  const suggestions = await getCachedSearchSuggestions(parsed.data.q);

  return NextResponse.json(suggestions, {
    headers: { "cache-control": "private, max-age=30" },
    status: 200,
  });
}
