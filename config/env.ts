import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const parsedServerEnv = serverEnvSchema.safeParse(process.env);

if (!parsedServerEnv.success) {
  console.error(
    "Invalid server environment variables",
    parsedServerEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid server environment variables");
}

const parsedClientEnv = clientEnvSchema.safeParse(process.env);

if (!parsedClientEnv.success) {
  console.error(
    "Invalid client environment variables",
    parsedClientEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid client environment variables");
}

export const serverEnv = parsedServerEnv.data;
export const clientEnv = parsedClientEnv.data;
