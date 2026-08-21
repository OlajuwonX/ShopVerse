import { NextResponse } from "next/server";
import { z } from "zod";

import {
  SEARCH_BURST_LIMIT,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SEARCH_SUSTAINED_LIMIT,
} from "@/constants/search";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getCachedSearchSuggestions } from "@/server/cache/search";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { getRequestContext } from "@/server/security/request-context";

const querySchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH),
});

const EMPTY = { brands: [], categories: [], products: [], term: "" };

function tooManyRequests(term: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { ...EMPTY, term },
    {
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.max(1, retryAfterSeconds)),
      },
      status: 429,
    },
  );
}

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
  const identifier = context.ip ?? "unknown";

  const burst = checkMemoryRateLimit(SEARCH_BURST_LIMIT, identifier);

  if (!burst.allowed) {
    return tooManyRequests(parsed.data.q, burst.retryAfterSeconds);
  }

  const sustained = await checkRateLimit(SEARCH_SUSTAINED_LIMIT, identifier);

  if (!sustained.allowed) {
    return tooManyRequests(
      parsed.data.q,
      Math.ceil((sustained.retryAfter.getTime() - Date.now()) / 1000),
    );
  }

  const suggestions = await getCachedSearchSuggestions(parsed.data.q);

  return NextResponse.json(suggestions, {
    headers: { "cache-control": "private, max-age=30" },
    status: 200,
  });
}
