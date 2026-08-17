import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env");

const FALLBACKS: Record<string, string> = {
  ADMIN_ROUTE_SEGMENT: "test-backoffice",
  APP_ORIGIN: "http://localhost:3000",
  AUTH_SECRET: "test-auth-secret-value-at-least-32-chars",
  DATABASE_URL: "postgres://placeholder:placeholder@localhost:5432/placeholder",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test-cloud",
};

function parseEnvFile(contents: string) {
  const values = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    values.set(key, value);
  }

  return values;
}

if (existsSync(ENV_FILE)) {
  for (const [key, value] of parseEnvFile(readFileSync(ENV_FILE, "utf8"))) {
    process.env[key] ??= value;
  }
}

for (const [key, value] of Object.entries(FALLBACKS)) {
  process.env[key] ??= value;
}

export const hasRealDatabase = !process.env.DATABASE_URL?.includes("placeholder");
