import { NextResponse } from "next/server";

import { CATALOGUE_BURST_LIMIT } from "@/constants/search";
import {
  CATALOGUE_CURSOR_PARAM,
  parseCatalogueRequest,
  toCatalogueQuery,
} from "@/features/products/schemas/catalogue-api";
import { getCachedProductPage } from "@/server/cache/catalogue";
import { checkMemoryRateLimit } from "@/server/security/memory-rate-limit";
import { getRequestContext } from "@/server/security/request-context";

const EMPTY_PAGE = { items: [], nextCursor: null, totalCount: 0 };

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(EMPTY_PAGE, {
    headers: {
      "cache-control": "no-store",
      "retry-after": String(Math.max(1, retryAfterSeconds)),
    },
    status: 429,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = await getRequestContext();
  const identifier = context.ip ?? "unknown";

  const burst = checkMemoryRateLimit(CATALOGUE_BURST_LIMIT, identifier);

  if (!burst.allowed) {
    return tooManyRequests(burst.retryAfterSeconds);
  }

  try {
    const catalogueRequest = parseCatalogueRequest(url.searchParams);
    const page = await getCachedProductPage(
      toCatalogueQuery(catalogueRequest, {
        cursor: url.searchParams.get(CATALOGUE_CURSOR_PARAM),
      }),
    );

    return NextResponse.json(page, {
      headers: { "cache-control": "private, max-age=30" },
      status: 200,
    });
  } catch (error) {
    console.error("catalogue_page_request_failed", {
      error: error instanceof Error ? error.message : "unknown",
      query: url.search,
    });

    return NextResponse.json(EMPTY_PAGE, {
      headers: { "cache-control": "no-store" },
      status: 400,
    });
  }
}
