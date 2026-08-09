import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { requireServerEnv } from "@/config/env";
import * as schema from "@/server/db/schema";

const databaseUrl = requireServerEnv("DATABASE_URL");
const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
export type Database = typeof db;
