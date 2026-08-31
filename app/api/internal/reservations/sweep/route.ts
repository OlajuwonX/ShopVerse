import { NextResponse } from "next/server";

import { writeAuditLog } from "@/server/security/audit";
import {
  authoriseInternalRequest,
  readInternalSecret,
} from "@/server/security/internal-auth";
import { getRequestContext } from "@/server/security/request-context";
import { expireStaleReservations } from "@/server/services/inventory";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

async function sweep(request: Request) {
  const outcome = authoriseInternalRequest(
    request.headers.get("authorization"),
    readInternalSecret(),
  );

  if (outcome !== "authorised") {
    return NextResponse.json(
      { error: "Not found" },
      { headers: NO_STORE, status: 404 },
    );
  }

  const context = await getRequestContext();

  try {
    const result = await expireStaleReservations();

    if (result.released > 0) {
      await writeAuditLog({
        action: "inventory.reservations.expired",
        actorType: "system",
        after: {
          released: result.released,
          skippedInFlight: result.skippedInFlight,
        },
        targetType: "inventory",
      });
    }

    return NextResponse.json(result, { headers: NO_STORE, status: 200 });
  } catch (error) {
    console.error("reservation_sweep_failed", {
      error: error instanceof Error ? error.message : "unknown",
      requestId: context.requestId,
    });

    return NextResponse.json(
      { error: "Sweep failed", requestId: context.requestId },
      { headers: NO_STORE, status: 500 },
    );
  }
}

export function GET(request: Request) {
  return sweep(request);
}

export function POST(request: Request) {
  return sweep(request);
}
