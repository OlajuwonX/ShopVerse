import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),

  ADMIN_ROUTE_SEGMENT: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
      message: "ADMIN_ROUTE_SEGMENT must be a lowercase URL-safe slug",
    })
    .optional(),

  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  CRON_SECRET: z.string().min(32).optional(),

  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_[A-Za-z0-9]+$/, {
      message: "PAYSTACK_SECRET_KEY must look like sk_test_... or sk_live_...",
    })
    .optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME must be URL-safe",
    })
    .optional(),
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

export function requireServerEnv<K extends keyof typeof serverEnv>(key: K) {
  const value = serverEnv[key];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${key}`);
  }

  return value;
}
