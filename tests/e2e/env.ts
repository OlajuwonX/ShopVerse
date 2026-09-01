import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readEnvValue(key: string): string | null {
  const fromEnv = process.env[key];

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  const file = resolve(process.cwd(), ".env");

  if (!existsSync(file)) {
    return null;
  }

  const match = new RegExp(`^${key}=(.*)$`, "m").exec(readFileSync(file, "utf8"));
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");

  return value && value.length > 0 ? value : null;
}

export function databaseUrl(): string | null {
  const value = readEnvValue("DATABASE_URL");

  return value && !value.includes("placeholder") ? value : null;
}
