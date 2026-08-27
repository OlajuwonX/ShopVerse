import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { requireServerEnv } from "@/config/env";
import * as schema from "@/server/db/schema";

let pool: Pool | null = null;

function getPool() {
  pool ??= new Pool({ connectionString: requireServerEnv("DATABASE_URL") });

  return pool;
}

export function getTransactionalDb() {
  return drizzle(getPool(), { schema });
}

export type TransactionalDatabase = ReturnType<typeof getTransactionalDb>;

export type Transaction = Parameters<
  Parameters<TransactionalDatabase["transaction"]>[0]
>[0];

export async function closeTransactionalPool() {
  if (pool) {
    const current = pool;

    pool = null;

    await current.end();
  }
}
